"""
Sporty — application entry point.

This file wires together routers, middleware, and lifecycle hooks.
It does NOT contain business logic or route handlers — those live
in their respective module routers (auth, league, player, scoring).

Security architecture:
  1. Security headers (CSP, HSTS, X-Frame-Options, etc.)
  2. CORS (environment-driven allowed origins)
  3. CSRF protection (double-submit cookie pattern)
  4. Rate limiting (IP-based, endpoint-specific limits)
  5. Authentication (httpOnly cookie-based JWT)

Middleware order matters:
  - Security headers: Applied first (outermost layer)
  - CORS: Applied before rate limiting
  - CSRF: Applied before rate limiting (for state-changing requests)
  - Rate limiting: Applied last (innermost layer before routers)
"""

from contextlib import asynccontextmanager
import asyncio
import logging
import os

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

# Import all models FIRST to ensure SQLAlchemy registers them before routers load
# This prevents "failed to locate a name" errors in relationships
from app.auth.models import User, RefreshToken  # noqa: F401
from app.league.models import (  # noqa: F401
    Sport, Season, TransferWindow, League, LeagueSport, LineupSlot,
  LeagueMembership, FantasyTeam, TeamPlayer, Transfer, BudgetTransaction,
    TeamGameweekLineup, TeamWeeklyScore, DraftPick, RosterMove,
    WaiverOrder, WaiverClaim, TradeOffer
)
from app.match.models import Match  # noqa: F401
from app.prediction.models import PredictionEntry  # noqa: F401
from app.player.models import (  # noqa: F401
  Player,
  PlayerGameweekStat,
  FootballStat,
  CricketStat,
  PlayerPriceHistory,
  UserFavouriteTeam,
  UserFavouritePlayer,
)
from app.player.models_nba import NBAStat  # noqa: F401
from app.ingestion.models import IngestionPlayer, IngestionTeam  # noqa: F401
from app.notification.models import Notification  # noqa: F401
from app.scoring.models import DefaultScoringRule  # noqa: F401
from app.admin.models import AdminAuditLog  # noqa: F401
from app.support.models import SupportTicket, TicketMessage  # noqa: F401
from app.league_chat.models import LeagueChatMessage, LeagueChatReaction  # noqa: F401
from app.database import SessionLocal
from app.core.redis import close_async_redis, get_redis
from app.core.config import settings
from app.services.league_status_service import auto_update_league_statuses
from app.services.cache_warming_service import warm_cache
from app.services.notification_service import check_and_notify_open_windows
from app.services.scoring.ranking import compute_and_store_rankings

# Import routers AFTER models are registered
from app.auth.router import router as auth_router
from app.league.router import router as league_router
from app.optimization.router import router as optimization_router
from app.player.router import router as player_router
from app.notification.router import router as notification_router
from app.scoring.router import router as scoring_router
from app.match.router import router as match_router
from app.prediction.router import router as prediction_router
from app.user.router import router as user_router
from app.api.v1.transfers import router as transfers_router
from app.api.v1.draft_roster import router as draft_roster_router
from app.api.v1.waivers import router as waivers_router
from app.api.v1.trades import router as trades_router
from app.api.v1.matchups import router as matchups_router
from app.api.v1.feed import router as feed_router
from app.api.routes.match import router as realtime_match_router
from app.api.routes.websocket import router as realtime_websocket_router
from app.api.routes.sse import router as realtime_sse_router
from app.admin.router import router as admin_router
from app.support.router import router as support_router
from app.league_chat.router import router as league_chat_router

logger = logging.getLogger(__name__)


# Every scheduler runs in-process, so with 2+ API instances each cron fires
# once PER INSTANCE. The waiver/trade jobs below always had Redis locks; these
# four were unguarded (double-sent notifications, double-run rankings). Same
# pattern everywhere now: skip the tick if another instance holds the lock.
def _run_transfer_window_notification_job() -> None:
  from app.core.redis_lock import redis_lock

  with redis_lock("lock:jobs:transfer_window_notifications", ttl_seconds=300) as acquired:
    if not acquired:
      return
    db = SessionLocal()
    try:
      stats = check_and_notify_open_windows(db)
      db.commit()
      logger.info(
        "Daily transfer-window notification job completed: %s",
        stats,
      )
    except Exception:
      db.rollback()
      logger.exception("Daily transfer-window notification job failed")
    finally:
      db.close()



def _run_league_lifecycle_job() -> None:
  from app.core.redis_lock import redis_lock

  with redis_lock("lock:jobs:league_lifecycle", ttl_seconds=300) as acquired:
    if not acquired:
      return
    db = SessionLocal()
    try:
      stats = auto_update_league_statuses(db)
      logger.info(
        "Daily league lifecycle job completed: %s",
        stats,
      )
    except Exception:
      db.rollback()
      logger.exception("Daily league lifecycle job failed")
    finally:
      db.close()


def _run_waiver_processing_job() -> None:
  from app.core.redis_lock import redis_lock
  from app.services.waiver_service import process_due_waivers

  # Serialise across instances — every instance runs its own scheduler, but the
  # roster mutations must be applied once. Skip this tick if another holds it.
  with redis_lock("lock:draft:waiver_processing", ttl_seconds=300) as acquired:
    if not acquired:
      return
    db = SessionLocal()
    try:
      stats = process_due_waivers(db)
      db.commit()
      if stats["windows"]:
        logger.info("Waiver processing job completed: %s", stats)
    except Exception:
      db.rollback()
      logger.exception("Waiver processing job failed")
    finally:
      db.close()


def _run_trade_finalization_job() -> None:
  from app.core.redis_lock import redis_lock
  from app.services.trade_service import finalize_due_trades

  with redis_lock("lock:draft:trade_finalization", ttl_seconds=300) as acquired:
    if not acquired:
      return
    db = SessionLocal()
    try:
      stats = finalize_due_trades(db)
      db.commit()
      if stats["executed"]:
        logger.info("Trade finalization job completed: %s", stats)
    except Exception:
      db.rollback()
      logger.exception("Trade finalization job failed")
    finally:
      db.close()


def _run_cache_warming_job() -> None:
  from app.core.redis_lock import redis_lock

  with redis_lock("lock:jobs:cache_warming", ttl_seconds=300) as acquired:
    if not acquired:
      return
    db = SessionLocal()
    try:
      redis = get_redis()
      stats = asyncio.run(warm_cache(db, redis))
      logger.info("Cache warming job completed: %s", stats)
    except Exception:
      logger.exception("Cache warming job failed")
    finally:
      db.close()


def _run_stale_match_watchdog_job() -> None:
  from app.core.redis_lock import redis_lock
  from app.services.feed_scoring import finalize_stale_live_matches

  with redis_lock("lock:jobs:stale_match_watchdog", ttl_seconds=300) as acquired:
    if not acquired:
      return
    db = SessionLocal()
    try:
      stats = finalize_stale_live_matches(db, get_redis())
      if stats["finalized"]:
        logger.info("Stale match watchdog completed: %s", stats)
    except Exception:
      db.rollback()
      logger.exception("Stale match watchdog job failed")
    finally:
      db.close()


def _run_gameweek_ranking_job() -> None:
  from datetime import datetime, timezone
  from app.core.redis_lock import redis_lock

  with redis_lock("lock:jobs:gameweek_ranking", ttl_seconds=300) as acquired:
    if not acquired:
      return
    db = SessionLocal()
    try:
      now = datetime.now(timezone.utc)
      window = (
        db.query(TransferWindow)
        .filter(TransferWindow.start_at <= now, TransferWindow.end_at >= now)
        .first()
      )
      if window is None:
        logger.info("Gameweek ranking job: no active transfer window, skipping")
        return
      compute_and_store_rankings(window.id, db)
      db.commit()
      logger.info("Gameweek ranking job completed for window %s", window.id)
    except Exception:
      db.rollback()
      logger.exception("Gameweek ranking job failed")
    finally:
      db.close()


# ═══════════════════════════════════════════════════════════════════════════════
# Lifespan — startup / shutdown hooks
# ═══════════════════════════════════════════════════════════════════════════════


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ─────────────────────────────────────────────────────
    # Validate environment configuration before accepting traffic
    try:
        settings.validate_production()
        logger.info("Environment validation passed for %s", settings.ENVIRONMENT)
    except ValueError as e:
        logger.critical("Environment validation failed: %s", e)
        raise

    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(
      _run_transfer_window_notification_job,
      trigger="cron",
      hour=8,
      minute=0,
      id="daily_transfer_window_notifications",
      replace_existing=True,
    )
    scheduler.add_job(
      _run_league_lifecycle_job,
      trigger="cron",
      hour=0,
      minute=0,
      id="daily_league_lifecycle",
      replace_existing=True,
    )
    scheduler.add_job(
      _run_cache_warming_job,
      trigger="cron",
      hour=0,
      minute=5,
      id="daily_cache_warming",
      replace_existing=True,
    )
    scheduler.add_job(
      _run_gameweek_ranking_job,
      trigger="cron",
      hour=2,
      minute=0,
      id="gameweek_ranking_update",
      replace_existing=True,
    )
    # Draft roster: resolve due waiver claims and finalise trades past their
    # veto window. Hourly so a window's waiver deadline is picked up promptly.
    scheduler.add_job(
      _run_waiver_processing_job,
      trigger="cron",
      minute=15,
      id="waiver_processing_hourly",
      replace_existing=True,
    )
    scheduler.add_job(
      _run_trade_finalization_job,
      trigger="cron",
      minute=20,
      id="trade_finalization_hourly",
      replace_existing=True,
    )
    # Watchdog: finish feeder matches orphaned on status='live' (the feeder's
    # simulation state is in-memory, so a feeder crash can't finish them).
    scheduler.add_job(
      _run_stale_match_watchdog_job,
      trigger="cron",
      minute=25,
      id="stale_match_watchdog_hourly",
      replace_existing=True,
    )
    scheduler.start()
    logger.info("APScheduler started with transfer, lifecycle, cache warming, price-update, and ranking jobs")

    # Kafka realtime pipeline — DORMANT: kept for a future real-matches API,
    # default-off, and its deps (aiokafka/influxdb-client/firebase-admin) are
    # not in requirements.txt. Install them when flipping the flag; imports
    # are lazy so the app runs fine without them.
    realtime_started = False
    if settings.REALTIME_PIPELINE_ENABLED:
      from app.core.kafka import create_producer
      from app.services.match_scheduler import MatchScheduler

      producer = await create_producer()
      match_scheduler = MatchScheduler(
        producer=producer,
        refresh_interval_seconds=settings.MATCH_SCHEDULER_REFRESH_SECONDS,
      )
      await match_scheduler.start()

      app.state.realtime_producer = producer
      app.state.match_scheduler = match_scheduler
      realtime_started = True
      logger.info("Realtime match scheduler started")

    yield
    # ── Shutdown ────────────────────────────────────────────────────
    if realtime_started:
      await app.state.match_scheduler.stop()
      await app.state.realtime_producer.stop()
      logger.info("Realtime match scheduler stopped")

    await close_async_redis()

    scheduler.shutdown(wait=False)
    logger.info("APScheduler shut down")


# ═══════════════════════════════════════════════════════════════════════════════
# Error tracking — auto-captures unhandled exceptions plus any logger.exception()
# / logger.error() call anywhere in the app (Sentry's logging integration is on
# by default). No-op when SENTRY_DSN is unset (e.g. local dev).
# ═══════════════════════════════════════════════════════════════════════════════

if settings.SENTRY_DSN:
    import sentry_sdk

    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        traces_sample_rate=0,  # error tracking only, no perf/APM sampling
        send_default_pii=False,
    )


# ═══════════════════════════════════════════════════════════════════════════════
# App instance
# ═══════════════════════════════════════════════════════════════════════════════


app = FastAPI(
    title="Sporty",
    description="Multi-sport fantasy league platform API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── OpenAPI 3.0.3 override for Swagger UI compatibility ─────────
# FastAPI 0.129+ generates OpenAPI 3.1.0 by default, which uses
# `anyOf: [..., null]` for optional fields (Python's `str | None`).
# Swagger UI has a known rendering bug with this pattern that causes
# blank pages. OpenAPI 3.0.3 uses `nullable: true` instead, which
# Swagger UI handles correctly.
#
# We override app.openapi() to force 3.0.3 output AND convert
# anyOf+null patterns to nullable: true.
from fastapi.openapi.utils import get_openapi
from typing import Any


def _convert_anyof_null_to_nullable(obj: Any) -> Any:
    """
    Recursively convert OpenAPI 3.1 `anyOf: [..., {"type": "null"}]`
    patterns to OpenAPI 3.0 `nullable: true` format.

    Handles:
      - 2-item: {"anyOf": [{"type": "string"}, {"type": "null"}]}
        → {"type": "string", "nullable": true}
      - 3-item: {"anyOf": [{"type": "number"}, {"type": "string"}, {"type": "null"}]}
        → {"anyOf": [{"type": "number"}, {"type": "string"}], "nullable": true}

    Leaves legitimate union types untouched (e.g., TokenResponse | UserResponse).
    """
    if isinstance(obj, dict):
        anyof = obj.get("anyOf")
        if isinstance(anyof, list) and len(anyof) >= 2:
            null_indices = [
                i for i, item in enumerate(anyof)
                if isinstance(item, dict) and item.get("type") == "null"
            ]

            if len(null_indices) == 1:
                non_null_items = [
                    item for i, item in enumerate(anyof) if i not in null_indices
                ]

                if len(non_null_items) == 1:
                    # Simple case: anyOf: [X, null] → X with nullable: true
                    result = dict(non_null_items[0])
                    result["nullable"] = True
                    for key in obj:
                        if key != "anyOf":
                            result[key] = obj[key]
                    return result

                elif len(non_null_items) >= 2:
                    # Multi-type case: anyOf: [A, B, null] → anyOf: [A, B] with nullable: true
                    result = {"anyOf": non_null_items, "nullable": True}
                    for key in obj:
                        if key != "anyOf":
                            result[key] = obj[key]
                    return result

        # Recurse into dict values
        return {key: _convert_anyof_null_to_nullable(value) for key, value in obj.items()}

    if isinstance(obj, list):
        return [_convert_anyof_null_to_nullable(item) for item in obj]

    return obj


def _custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    app.openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        openapi_version="3.0.3",
        description=app.description,
        terms_of_service=app.terms_of_service,
        contact=app.contact,
        license_info=app.license_info,
        routes=app.routes,
        tags=app.openapi_tags,
        servers=app.servers,
    )
    # Convert anyOf+null → nullable: true for Swagger UI compatibility
    app.openapi_schema = _convert_anyof_null_to_nullable(app.openapi_schema)
    return app.openapi_schema

app.openapi = _custom_openapi

# ── Prometheus metrics ────────────────────────────────────────────
Instrumentator().instrument(app).expose(app, include_in_schema=False, endpoint="/metrics")


# ═══════════════════════════════════════════════════════════════════════════════
# Middleware (order matters — outermost first)
# ═══════════════════════════════════════════════════════════════════════════════

# 1. Security headers — applied to ALL responses
# Adds CSP, HSTS, X-Frame-Options, X-Content-Type-Options, etc.
from app.middleware.security_headers import SecurityHeadersMiddleware
app.add_middleware(SecurityHeadersMiddleware)

# 2. CORS — cross-origin resource sharing
# Origins are environment-driven so production can allow the deployed frontend.
# expose_headers is required so JavaScript can read custom response
# headers (X-CSRF-Token, rate limit headers) in cross-origin requests.
# max_age caches preflight (OPTIONS) responses to reduce latency.
allow_origins = settings.get_cors_origins()
logger.info("CORS origins configured for cross-origin cookie auth: %s", allow_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # No allow_origin_regex: a previous r"^https://([\w-]+\.)?vercel\.app$"
    # matched EVERY vercel.app deployment — anyone's free Vercel site could
    # make credentialed requests AND read exposed headers (including
    # X-CSRF-Token), a full CSRF bypass. Origins are the explicit env-driven
    # list only; add a specific preview origin to CORS_STAGING_ORIGINS if one
    # is ever needed.
    expose_headers=["X-CSRF-Token", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
    max_age=600,  # Cache preflight for 10 minutes
)


# 3. CSRF protection — double-submit cookie pattern
# Protects state-changing requests (POST, PUT, PATCH, DELETE)
from app.middleware.csrf import CSRFMiddleware
app.add_middleware(
    CSRFMiddleware,
    exempt_paths=settings.get_csrf_exempt_paths(),
)

# 4. Rate limiting — IP-based throttling
# Different limits per endpoint category (auth endpoints are stricter)
from app.middleware.rate_limiter import RateLimitMiddleware
app.add_middleware(RateLimitMiddleware)


# ═══════════════════════════════════════════════════════════════════════════════
# Global exception handlers — catch unhandled errors, log with context,
# return safe responses (no stack traces or internals leaked).
# ═══════════════════════════════════════════════════════════════════════════════

from fastapi.responses import JSONResponse


@app.exception_handler(Exception)
async def global_exception_handler(request, exc: Exception):
    """Catch-all for unexpected errors. Logs full traceback with request
    context, then returns a generic 500 so internals are never leaked."""
    import traceback

    logger.exception(
        "Unhandled exception on %s %s (user_agent=%s)",
        request.method,
        request.url.path,
        request.headers.get("user-agent", "unknown"),
        exc_info=exc,
    )
    if settings.SENTRY_DSN:
        import sentry_sdk

        sentry_sdk.capture_exception(exc)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An internal server error occurred. Please try again later.",
            "request_id": str(id(request)),
        },
    )


from app.core.errors import DomainError


@app.exception_handler(DomainError)
async def domain_error_handler(request, exc: DomainError):
    """Business-rule violations with client-safe messages → 400.

    Only DomainError is echoed to the client. A bare ValueError is an
    internal bug and falls through to the generic 500 handler above —
    the old ValueError→400 handler leaked str(exc) for ANY ValueError
    raised anywhere in the stack.
    """
    logger.warning(
        "DomainError on %s %s: %s",
        request.method,
        request.url.path,
        exc,
    )
    return JSONResponse(
        status_code=400,
        content={"detail": str(exc)},
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Router registration — all under /api/v1
# ═══════════════════════════════════════════════════════════════════════════════


app.include_router(auth_router,    prefix="/api/v1")
app.include_router(league_router,  prefix="/api/v1")
app.include_router(optimization_router, prefix="/api/v1")
app.include_router(player_router,  prefix="/api/v1")
app.include_router(notification_router, prefix="/api/v1")
app.include_router(scoring_router, prefix="/api/v1")
app.include_router(match_router, prefix="/api/v1")
app.include_router(prediction_router, prefix="/api/v1")
app.include_router(user_router, prefix="/api/v1")
app.include_router(transfers_router, prefix="/api/v1")
app.include_router(draft_roster_router, prefix="/api/v1")
app.include_router(waivers_router, prefix="/api/v1")
app.include_router(trades_router, prefix="/api/v1")
app.include_router(matchups_router, prefix="/api/v1")
app.include_router(feed_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(support_router, prefix="/api/v1")
app.include_router(league_chat_router, prefix="/api/v1")
app.include_router(realtime_match_router, prefix="/api")
app.include_router(realtime_websocket_router, prefix="/api")
app.include_router(realtime_sse_router, prefix="/api")


# ═══════════════════════════════════════════════════════════════════════════════
# Health check — outside /api/v1 (infrastructure, not business logic)
# ═══════════════════════════════════════════════════════════════════════════════


@app.get("/health", tags=["Health"])
def health_check():
    """Minimal liveness probe for load balancers and container orchestrators.

    Why /health and not just GET /?
    ────────────────────────────────
    - Load balancers (ALB, Nginx) need a dedicated path to poll.
      Putting it at / conflicts with a frontend SPA's index.html.
    - Kubernetes liveness/readiness probes expect a fast, side-effect-
      free endpoint that returns 200 when the service is alive.
    - Monitoring dashboards (Datadog, Grafana) scrape /health every
      few seconds — it must be cheap (no DB query, no auth).

    Why outside /api/v1?
    ────────────────────
    Health checks are infrastructure concerns, not business API
    endpoints.  They shouldn't change when you version the API.
    /health stays the same whether clients use /api/v1 or /api/v2.
    """
    return {"status": "ok"}

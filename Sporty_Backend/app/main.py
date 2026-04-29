"""
Sporty — application entry point.

This file wires together routers, middleware, and lifecycle hooks.
It does NOT contain business logic or route handlers — those live
in their respective module routers (auth, league, player, scoring).

─────────────────────────────────────────────────────────────────────────────
Q1: What does include_router() do?
    Why not define all routes in main.py directly?
─────────────────────────────────────────────────────────────────────────────
include_router() merges a router's endpoints into the FastAPI app
at registration time.  It copies each route's path, method, handler,
dependencies, and tags into the app's route table — as if the routes
were defined here, but without coupling main.py to every handler.

Why not define routes directly in main.py?
  - Separation of concerns: main.py is the WIRING layer, not the
    business logic layer.  auth/ owns auth routes, league/ owns
    league routes.  main.py just plugs them together.
  - Scalability: with 30+ endpoints across 4 modules, a monolithic
    main.py becomes unreadable.  Routers split it into focused files.
  - Team workflow: two developers can edit league/router.py and
    scoring/router.py simultaneously with zero merge conflicts in
    main.py.
  - Testing: you can mount a single router in a TestClient without
    booting the full app.

─────────────────────────────────────────────────────────────────────────────
Q2: Should we add a global /api/v1 prefix?
─────────────────────────────────────────────────────────────────────────────
Yes.  Every router is mounted under prefix="/api/v1".

Why?
  - Versioning: when a breaking change ships (v2), old mobile clients
    still hit /api/v1 while new ones hit /api/v2.  Both coexist on
    the same server.  Without a version prefix, you'd need a whole
    new domain or header-based routing — harder to debug, cache, and
    document.
  - Reverse proxy clarity: Nginx/Caddy can route /api/* to the
    backend and /* to the frontend SPA in one location block.
  - No path collision: the frontend can own / and /about while the
    API owns /api/v1/* — no ambiguity.

Applied below via: app.include_router(router, prefix="/api/v1")

─────────────────────────────────────────────────────────────────────────────
Q3: What are CORS middleware and lifespan?
    Why does every production FastAPI app need both?
─────────────────────────────────────────────────────────────────────────────
CORS (Cross-Origin Resource Sharing):
  Browsers enforce the Same-Origin Policy — JavaScript on
  https://sporty.app cannot call https://api.sporty.app unless the
  API responds with Access-Control-Allow-Origin headers.
  CORSMiddleware injects those headers on every response.
  Without it, every fetch() from the frontend fails with a CORS error
  before the request even reaches your route handler.

  allow_origins=["*"] is a development shortcut.  In production,
  lock this down to the actual frontend origin(s) to prevent
  third-party sites from making authenticated requests on behalf
  of your users (CSRF-adjacent risk when allow_credentials=True).

Lifespan (asynccontextmanager):
  FastAPI's lifespan hook replaces the deprecated on_event("startup")
  / on_event("shutdown") pattern.  Code before `yield` runs once at
  startup (verify DB connection, warm caches, start background tasks).
  Code after `yield` runs once at shutdown (close connection pools,
  flush logs, cancel background tasks).

  Why needed in production:
    - Startup: fail fast if the DB is unreachable — better to crash
      immediately than accept requests and return 500s.
    - Shutdown: close DB pools cleanly so PostgreSQL doesn't see
      abrupt disconnects and fill pg_stat_activity with idle-in-
      transaction sessions.
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
    TeamGameweekLineup, TeamWeeklyScore
)
from app.match.models import Match  # noqa: F401
from app.player.models import (  # noqa: F401
  Player,
  PlayerGameweekStat,
  FootballStat,
  CricketStat,
  PlayerPriceHistory,
)
from app.player.models_nba import NBAStat  # noqa: F401
from app.notification.models import Notification  # noqa: F401
from app.scoring.models import DefaultScoringRule, LeagueScoringOverride  # noqa: F401
from app.database import SessionLocal
from app.core.redis import close_async_redis, get_redis
from app.core.config import settings
from app.services.league_status_service import auto_update_league_statuses
from app.services.cache_warming_service import warm_cache
from app.services.notification_service import check_and_notify_open_windows
from app.services.price_update_service import update_player_prices

# Import routers AFTER models are registered
from app.auth.router import router as auth_router
from app.league.router import router as league_router
from app.optimization.router import router as optimization_router
from app.player.router import router as player_router
from app.notification.router import router as notification_router
from app.scoring.router import router as scoring_router
from app.user.router import router as user_router
from app.api.v1.transfers import router as transfers_router
from app.api.routes.match import router as realtime_match_router
from app.api.routes.websocket import router as realtime_websocket_router
from app.api.routes.sse import router as realtime_sse_router

logger = logging.getLogger(__name__)


def _run_transfer_window_notification_job() -> None:
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


def _run_cache_warming_job() -> None:
  db = SessionLocal()
  try:
    redis = get_redis()
    stats = asyncio.run(warm_cache(db, redis))
    logger.info("Cache warming job completed: %s", stats)
  except Exception:
    logger.exception("Cache warming job failed")
  finally:
    db.close()


def _run_price_update_job() -> None:
  db = SessionLocal()
  try:
    redis = get_redis()
    stats = asyncio.run(update_player_prices(db, redis))
    logger.info("Price update job completed: %s", stats)
  except Exception:
    db.rollback()
    logger.exception("Price update job failed")
  finally:
    db.close()


# ═══════════════════════════════════════════════════════════════════════════════
# Lifespan — startup / shutdown hooks
# ═══════════════════════════════════════════════════════════════════════════════


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ─────────────────────────────────────────────────────
    # Future: verify DB connection, run Alembic check, warm caches.
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
      _run_price_update_job,
      trigger="cron",
      hour="*/4",
      minute=0,
      id="price_update_every_4h",
      replace_existing=True,
    )
    scheduler.start()
    logger.info("APScheduler started with transfer, lifecycle, cache warming, and price-update jobs")

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

Instrumentator().instrument(app).expose(app, include_in_schema=False, endpoint="/metrics")


# ═══════════════════════════════════════════════════════════════════════════════
# Middleware
# ═══════════════════════════════════════════════════════════════════════════════


default_origins = (
  "http://localhost:5173,"
  "http://127.0.0.1:5173,"
  "http://localhost:3000,"
  "http://127.0.0.1:3000"
)
raw_origins = os.getenv("CORS_ALLOW_ORIGINS", default_origins)
allow_origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
if not allow_origins:
    allow_origins = [origin.strip() for origin in default_origins.split(",")]

default_origin_regex = r"https?://(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.\d+\.\d+)(:\d+)?"
allow_origin_regex = (os.getenv("CORS_ALLOW_ORIGIN_REGEX") or "").strip() or default_origin_regex

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
  # Helpful in local dev when frontend runs on a different localhost/LAN port.
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
  # Includes Authorization so JWT-bearing requests are accepted.
    allow_headers=["*"],
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
app.include_router(user_router, prefix="/api/v1")
app.include_router(transfers_router, prefix="/api/v1")
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
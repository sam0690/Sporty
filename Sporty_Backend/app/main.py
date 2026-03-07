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

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.router import router as auth_router
from app.league.router import router as league_router
from app.player.router import router as player_router
from app.scoring.router import router as scoring_router


# ═══════════════════════════════════════════════════════════════════════════════
# Lifespan — startup / shutdown hooks
# ═══════════════════════════════════════════════════════════════════════════════


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ─────────────────────────────────────────────────────
    # Future: verify DB connection, run Alembic check, warm caches.
    # For now this is a no-op placeholder — the important thing is
    # the STRUCTURE exists so adding startup logic later doesn't
    # require refactoring main.py.
    yield
    # ── Shutdown ────────────────────────────────────────────────────
    # Future: close connection pools, flush caches, cancel tasks.


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


# ═══════════════════════════════════════════════════════════════════════════════
# Middleware
# ═══════════════════════════════════════════════════════════════════════════════


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # TODO: lock down to actual frontend origin in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ═══════════════════════════════════════════════════════════════════════════════
# Router registration — all under /api/v1
# ═══════════════════════════════════════════════════════════════════════════════


app.include_router(auth_router,    prefix="/api/v1")
app.include_router(league_router,  prefix="/api/v1")
app.include_router(player_router,  prefix="/api/v1")
app.include_router(scoring_router, prefix="/api/v1")


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
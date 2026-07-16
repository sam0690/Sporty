# 02 — Overall Architecture

> Visual diagrams for everything in this chapter live in `/diagrams` (component,
> deployment, and data-flow diagrams are kept separate from prose per the
> documentation format for this repo). This chapter is the prose explanation of what
> each diagram shows and why it's built that way.
>
> Relevant diagrams: [`diagrams/11_component_diagram.md`](../diagrams/11_component_diagram.md),
> [`diagrams/12_deployment_diagram.md`](../diagrams/12_deployment_diagram.md).

## 1. The three deployable units

Sporty is **three independently-deployed processes** plus shared infrastructure:

1. **`Sporty_Backend`** (FastAPI, Python) — owns all durable state (PostgreSQL) and
   all business logic. Exposes REST under `/api/v1` and realtime (WebSocket + SSE)
   under `/api`. Also runs an in-process scheduler and is driven from outside by
   Celery worker/beat processes.
2. **`sporty-frontend`** (Next.js, TypeScript) — the browser-facing SPA. Talks to the
   backend only over HTTP/WebSocket; never touches the database or the feeder
   directly; never holds an auth token in JavaScript.
3. **`SportyDataFeeder`** (FastAPI, Python, sibling repo) — a standalone match
   simulator with its own PostgreSQL database. Talks to the backend only over
   `/api/v1/feed/*`, authenticated by a shared secret, server-to-server.

Redis and PostgreSQL are the shared infrastructure the backend depends on; the feeder
has its **own separate** PostgreSQL database (never the same schema or instance as the
backend's).

## 2. Backend architecture

The backend (`Sporty_Backend/app/`) is organized as **vertical feature slices**: each
business domain owns its own `models.py` / `router.py` / `services.py` / `schemas.py`
inside its own directory, rather than a horizontal "all models here, all routers
there" layout. Slices: `auth/`, `league/` (the largest — leagues, draft, transfers,
lineup, leaderboard, `sportConfigs.py`), `player/`, `match/`, `scoring/`,
`notification/`, `user/` (profile + per-sport favourite team/player), `optimization/`,
`admin/` (platform-admin API: user/league/season management, scoring recalcs, job
health, feature flags, ticket handling — every action audit-logged to
`admin_audit_logs`), `support/` (user-facing support tickets).

Cross-cutting layers sit alongside the slices:

- `app/database.py` — the **sync** SQLAlchemy engine (`psycopg2`), `SessionLocal`,
  and the `get_db` FastAPI dependency. Used by nearly every router, service, and
  scheduled job.
- `app/core/database.py` — the **async** SQLAlchemy engine (`asyncpg`), `get_async_db`.
  Used **only** by the realtime WebSocket/SSE/match-state routes. Its URL is derived
  by rewriting `postgresql://` → `postgresql+asyncpg://` from the same `DATABASE_URL`.
- `app/core/security.py`, `app/core/config.py`, `app/core/redis_lock.py`,
  `app/core/celery_app.py` — JWT primitives, environment-driven `Settings`, the Redis
  distributed-lock helper, and the Celery application object.
- `app/middleware/` — security headers, CSRF, rate limiting (CORS is configured
  directly in `app/main.py`).
- `app/services/` — logic that spans slices or doesn't belong to one feature's HTTP
  surface: `services/scoring/` (the gameweek scoring engine), `services/optimization/`
  (the lineup ILP), `services/pricing/` (form-based repricing),
  `services/sync/` (real-API pollers, off by default), `feed_scoring.py` (bridges live
  events into fantasy points), `draft_roster_service.py`, `waiver_service.py`,
  `trade_service.py`, `transfer_service.py`, `transfer_session_service.py`,
  `league_status_service.py`, `price_update_service.py`, `storage_service.py`
  (Cloudflare R2 uploads), `connection_manager.py` (WebSocket fan-out),
  `match_scheduler.py` (dormant Kafka pipeline orchestration).
- `app/tasks/` — Celery task definitions + the Beat schedule.
- `app/adapters/`, `app/consumers/`, `app/workers/` — the **dormant** Kafka realtime
  pipeline (gated by `REALTIME_PIPELINE_ENABLED`, default off, explicitly documented
  in the codebase as "not prod-tested").
- `app/models/db/` — shared models that don't belong to one feature slice
  (`live_event.py`, `match_feed_cache.py`).

Two conventions shape the entire codebase (from `Sporty_Backend/CLAUDE.md`):

1. **Services never call `db.commit()`.** The router or scheduled job that invoked a
   service owns the transaction. This keeps multi-step service calls composable
   inside one atomic unit without a service accidentally ending someone else's
   transaction early.
2. **Every model module is imported up-front**, before any router is registered, in
   both `app/main.py` (API process) and `app/core/celery_app.py` (worker process).
   Cross-module relationships are declared with string targets
   (`relationship("User")`) to avoid circular imports, and SQLAlchemy only resolves
   those strings once every model class has been loaded into its registry — so a
   worker process that never runs `main.py` needs its own explicit import block, or
   the first query touching a cross-module relationship fails with "failed to locate
   a name."

See [`diagrams/09_refined_class_diagram.md`](../diagrams/09_refined_class_diagram.md)
for the concrete classes, and [07 — Database](07_DATABASE.md) for the schema those
classes map to.

## 3. Frontend architecture

The frontend (`sporty-frontend/src/`) enforces a strict one-directional layering
(from `AGENTS.md`/`CLAUDE.md`): **Backend → services → hooks (React Query) →
store/UI**. A UI component never calls Axios directly, and business logic never lives
in a component.

| Layer | Folder | Responsibility |
|---|---|---|
| Routing | `src/app/` | Next.js App Router route groups (`(auth)`, `(dashboard)`, `(public)`) + a top-level `match/[matchId]` route. `(dashboard)` includes the role-gated `/admin` console and the one-time post-signup `/onboarding/favourites` step (admins land on `/admin` after login; every navigable route is registered in `src/lib/route.config.ts`) |
| API transport | `src/api/` | Two Axios instances (`public-api-client.ts`, `auth-api-client.ts`) + the endpoint registry (`apiPath.ts`) |
| Services | `src/services/` | One typed module per domain (`LeagueService`, `TeamService`, `PlayerService`, `ScoringService`, `OptimizationService`, `UserService`, `MatchService`, `FeatureService`) — the **only** place Axios is called |
| Hooks | `src/hooks/` | Generic React Query wrappers (`useApiQuery`, `useApiMutation`) + domain hooks that wire services to query keys/cache invalidation |
| Store | `src/store/` | Zustand — used only for the genuinely-shared live-match state (`matchStore.ts`) |
| Cross-cutting | `src/lib/` | `realtimeApi.ts`/`socket.ts` (live match client), `storage.*`, `route.config.ts`, `sanitize.ts`, `validations.ts`, `toastifier.ts`, `auth-events.ts` |
| Features | `src/features/` | Feature modules (`create-league`, `create-team`, `my-team`, `transfers`, `waivers`, `trades`, `free-agents`, `leagues`, `landing`, `gallery`, `profile`, …) composing components + hooks |
| Types | `src/types/` | TypeScript interfaces mirroring backend schemas |
| Components | `src/components/` | Presentational and semi-smart components, incl. `components/live/` for the live-match UI |
| Domain | `src/domain/squadEngine` | Client-side mirrors of squad/position rules used for instant UI validation before a request round-trips |

Path alias `@/*` → `src/*`. Providers are composed in `src/app/client.tsx`:
`MantineProvider` → `QueryProvider` (React Query) → `AuthProvider`.

### Why two Axios clients

Because auth is httpOnly-cookie based (no token ever touches JavaScript), both
clients set `withCredentials: true` and manage an **in-memory** CSRF token captured
from response headers. `public-api-client.ts` is for unauthenticated calls;
`auth-api-client.ts` adds a **401 auto-refresh with a de-duped promise**: the first
401 across any number of simultaneous requests triggers one `/auth/refresh` call, and
every other 401'd request awaits that same promise before retrying once. See
[10 — Security](10_SECURITY.md).

Every backend URL the frontend calls is registered once in `src/api/apiPath.ts`
(`API_PATHS`) — this is the contract surface between the two apps: a backend route
rename requires updating `API_PATHS` and the corresponding service, and nothing else.

## 4. Databases

- **PostgreSQL (backend)** — the single source of truth for all user, league, squad,
  scoring, and match data. See [07 — Database](07_DATABASE.md).
- **PostgreSQL (feeder)** — a completely separate database owned by
  `SportyDataFeeder`, with **integer** primary keys (vs. the backend's UUIDs). The two
  databases are bridged only by an `entity_links` table inside the feeder's DB that
  maps feeder integer ids to backend UUID strings — there is no foreign key or shared
  schema between them.
- **SQLite** — used only by the backend's test suite (`tests/conftest.py`) as an
  in-memory/throwaway substitute for PostgreSQL, with DDL shims for
  Postgres-only features (`ExcludeConstraint` skipped, `JSONB` rendered as `JSON`).

## 5. Cache, sessions, pub/sub, and the message broker

**Redis is the connective tissue** of the backend, serving five distinct roles out of
one deployment (Upstash in production, per `docker-compose`/env conventions):

1. **Cache** — leaderboard cache keys (`leaderboard:{league}:{window}`), player-price
   mirrors (`player:prices`), a 30-minute auto-pick candidate-pool cache.
2. **Pub/sub** — live match fan-out (`{prefix}:{live_key}` for score/points,
   `leaderboard:{live_key}` for leaderboard deltas) consumed by the WebSocket/SSE
   routes.
3. **Distributed locks** — `app/core/redis_lock.py`'s `SET NX EX` + Lua-script-guarded
   release, protecting scoring runs, auto-pick, waiver/trade scheduler jobs, and more.
4. **Ephemeral session storage** — the staged-transfer session (`session:{user_id}`,
   1h TTL) and CSRF/rate-limit counters.
5. **Celery broker + result backend** — separate logical Redis databases (broker db 1,
   result backend db 2, per `Sporty_Backend/CLAUDE.md`), with `task_ignore_result=True`
   globally set (see [07 — Background Jobs](07-background-jobs.md) content folded
   into [06 — Algorithms](06_ALGORITHMS.md) §6a and [09 — Deployment](09_DEPLOYMENT.md)).

There is no separate caching layer (no Memcached, no CDN-level API caching evidenced
in the repo beyond Vercel's static-asset edge caching for the frontend build).

## 6. Message broker / event streaming

Two message-passing subsystems exist, at very different levels of production-readiness:

- **Celery + Redis** (broker) — production, always on. Used for scoring, pricing,
  auto-lock, and (commented out in the Beat schedule) external-API sync tasks.
- **Kafka** (`aiokafka`) — a fully-coded but **dormant** realtime pipeline
  (`REALTIME_PIPELINE_ENABLED`, default `False`, documented in the repo itself as
  "not prod-tested"). See [06 — Algorithms](06_ALGORITHMS.md) and
  [12 — Code Walkthrough](12_CODE_WALKTHROUGH.md) for what it does when enabled.
  **Could not determine from the codebase** whether a real Kafka broker is
  provisioned anywhere in the current deployment — no infra-as-code or broker URL is
  checked into the repo beyond the `KAFKA_*` settings keys.

## 7. External providers

| Provider | Used for | Status |
|---|---|---|
| API-Football (RapidAPI) | Real football fixtures/rosters/live events | Code complete, **gated off** (`LIVE_POLLING_ENABLED=False`); sync tasks commented out of the Celery Beat schedule |
| API-NBA (RapidAPI) | Real NBA live box scores | Code complete, same gating |
| `nba_api` | NBA roster/reference data ingestion | Used by ingestion scripts |
| Cricbuzz, BallDontLie | Referenced in `Sporty_Backend/CLAUDE.md` as external data sources for ingestion scripts | **Could not determine** current activity level beyond the CLAUDE.md mention and `scripts/sync_*.py` presence |
| Google OAuth | Sign-in/sign-up | Active — see [10 — Security](10_SECURITY.md) |
| Cloudflare R2 | Avatar + team-logo object storage | Active (`app/services/storage_service.py`, `boto3`) |
| SportyDataFeeder | Simulated match data (the *actual* current data source) | Active, primary |

## 8. Data flow (narrative)

```
SportyDataFeeder (ML models + simulation loop)
        │  HTTP push, X-Feeder-Secret
        ▼
Sporty_Backend  /api/v1/feed/*  → PostgreSQL (Match, LiveEvent, PlayerGameweekStat, …)
        │                              │
        │  Redis pub/sub               │  Celery send_task
        ▼                              ▼
WebSocket/SSE → sporty-frontend   Celery worker → scoring engine → TeamWeeklyScore + RANK()
        (live match page)                              │
                                                         ▼
                                        GET /leagues/{id}/leaderboard (frontend)
```

The full step-by-step trace (with exact function names) is in
[03 — Request Flow](03_REQUEST_FLOW.md).

## 9. Request lifecycle (summary)

Every REST request to the backend passes through, in order: security headers → CORS
→ CSRF double-submit → rate limiting → the `get_current_active_user` auth dependency
→ router → service (business logic, no commit) → PostgreSQL, with the router
committing the transaction on the way out. Realtime requests (`/api/ws/*`, SSE) skip
CSRF (no state-changing verb) and instead subscribe to a Redis pub/sub channel. Full
detail, including the frontend's Axios interceptor chain, is in
[03 — Request Flow](03_REQUEST_FLOW.md).

## Explain Like I'm New

Picture three separate offices working together: the **Backend office** keeps every
record (who owns which players, everyone's scores, all the rules) in one big filing
cabinet (PostgreSQL) and has a very fast notepad (Redis) for things it needs to
remember briefly or share instantly with many people at once (like "the score just
changed — tell everyone watching"). The **Frontend office** is the reception desk —
it never touches the filing cabinet itself, it always asks the Backend office to look
something up or write something down. The **Feeder office** is a separate building
that phones in play-by-play commentary for matches it's simulating; the Backend
office answers the phone with a password (the shared secret) instead of letting
anyone from that building walk in.

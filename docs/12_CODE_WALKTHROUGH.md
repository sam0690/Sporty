# 12 — Code Walkthrough

A directory-by-directory tour of the codebase. This chapter is deliberately a
**map with pointers**, not a re-statement of every function's logic — the deep
mechanical detail for each subsystem already lives in a dedicated chapter (linked
inline); duplicating it here would drift out of sync. Use this chapter to find
**where** something lives, then follow the link for **how** it works.

## `Sporty_Backend/app/` — top level

| File | Purpose | Execution order |
|---|---|---|
| `main.py` | Imports every model module (so cross-module `relationship("...")` strings resolve), builds the FastAPI app, registers middleware (outermost→innermost: security headers, CORS, CSRF, rate limiting), mounts every router (see [08 — API](08_API.md)), starts the APScheduler lifespan (and, conditionally, the Kafka `MatchScheduler`), registers global exception handlers, exposes `/metrics` | Runs once at process boot, before any request is served |
| `database.py` | Sync SQLAlchemy engine, `SessionLocal`, `get_db` dependency, 20+20 connection pool | Imported by nearly every router/service |
| `core/database.py` | Async engine (`asyncpg`), `get_async_db` — realtime routes only | Imported only by `api/routes/*` realtime modules |
| `core/security.py` | Pure JWT/password functions (`create_access_token`, `decode_access_token`, `hash_password`, `verify_password`, `create_password_reset_token`) | Called by `auth/router.py`, `auth/dependencies.py` |
| `core/config.py` | `Settings` (pydantic-settings, env-driven), `validate_production()` (boot-time fail-fast checks) | Instantiated once, imported everywhere as `settings` |
| `core/redis_lock.py` | `redis_lock(key, ttl)` context manager — see [06 — Algorithms](06_ALGORITHMS.md) §7a | Used by scoring, pricing, auto-pick, waiver/trade scheduler jobs |
| `core/celery_app.py` | Celery app object; **re-imports every model module** (mirroring `main.py`) since worker processes never run `main.py` | Imported by every task module and by the `celery worker`/`celery beat` CLI entry points |

## `app/auth/` — identity

`models.py` (`User`, `RefreshToken`), `router.py` (all `/auth/*` endpoints),
`dependencies.py` (`get_current_user`, `get_current_active_user`), `schemas.py`
(Pydantic request/response shapes), `services.py` (registration, login, Google
linking business logic — called by the router, never commits). Full detail:
[10 — Security](10_SECURITY.md).

## `app/league/` — the largest slice

- `models.py` — every league-domain table (see [07 — Database](07_DATABASE.md)).
- `router.py` (~900 lines) — every `/leagues/*` endpoint (see [08 — API](08_API.md)).
- `services.py` (~2700 lines) — the business logic behind nearly all of it: league
  CRUD, join/leave, the snake draft, budget-league team building, transfers
  (`make_transfer`), lineup setting (`update_lineup`), the leaderboard query
  (`get_league_leaderboard`). Full mechanical detail in
  [06 — Algorithms](06_ALGORITHMS.md) and [03 — Request Flow](03_REQUEST_FLOW.md).
- `sportConfigs.py` — `SPORT_CONFIGS` (squad-build quotas/minimums) and
  `SPORT_CONFIG_REGISTRY` (single vs. mixed starter minimums) — **two overlapping
  dicts**, a real footgun flagged in the code's own comments (see
  [14 — Improvements](14_IMPROVEMENTS.md)).
- `auto_pick_service.py` — the ILP squad-suggestion solver
  ([06 — Algorithms](06_ALGORITHMS.md) §1a).
- `dependencies.py` — `require_league_member`/`require_league_owner` FastAPI
  dependencies.
- `schemas.py` — request/response Pydantic models for the whole slice.

## `app/services/` — cross-slice business logic

| Subpackage/file | Purpose | Detail |
|---|---|---|
| `scoring/engine.py`, `player_scoring.py`, `team_scoring.py`, `ranking.py`, `rules.py`, `trigger.py`, `window_locator.py`, `auto_subs.py` | The gameweek scoring pipeline: effective-rule resolution, per-sport point formulas, formation-aware auto-substitution, captain/vice, `RANK()` standings, on-finish enqueue | [06 — Algorithms](06_ALGORITHMS.md) §3, §6f; [03 — Request Flow](03_REQUEST_FLOW.md) |
| `optimization/ilp_optimizer.py` | The stateless lineup+captain/vice ILP | [06 — Algorithms](06_ALGORITHMS.md) §1b |
| `pricing/repricing.py` | Form-based recency-weighted pricing (Celery `pricing.recalculate`) | [06 — Algorithms](06_ALGORITHMS.md) §4a |
| `price_update_service.py` | Demand+performance blend pricing (APScheduler 4-hourly job) | [06 — Algorithms](06_ALGORITHMS.md) §4b |
| `feed_scoring.py` | Bridges feeder/real-API events into live Redis deltas (`apply_live_points`) and persisted stats (`persist_match_stats`) | [06 — Algorithms](06_ALGORITHMS.md) §6b/§6c; [03 — Request Flow](03_REQUEST_FLOW.md) |
| `sync/football_live_sync.py`, `sync/nba_live_sync.py` | Real-API live pollers, gated by `LIVE_POLLING_ENABLED` | [06 — Algorithms](06_ALGORITHMS.md) §6e |
| `transfer_service.py`, `transfer_session_service.py` | The staged (Redis-session) transfer flow | [06 — Algorithms](06_ALGORITHMS.md), [08 — API](08_API.md) |
| `transfer_window_service.py` | Auto-lock jobs + deadline validation helpers | [03 — Request Flow](03_REQUEST_FLOW.md) |
| `league_status_service.py` | The daily lifecycle-transition job | [02 — Architecture](02_ARCHITECTURE.md) |
| `draft_roster_service.py` | Free-agent pool + add/drop validation shared by free-agent claims, waivers, and trades | [06 — Algorithms](06_ALGORITHMS.md) §5 |
| `waiver_service.py` | Rolling-priority waiver claim submission + weekly resolution | [06 — Algorithms](06_ALGORITHMS.md) §5a |
| `trade_service.py` | Propose/accept/reject/cancel/veto/execute trade state machine | [06 — Algorithms](06_ALGORITHMS.md) §5b |
| `storage_service.py` | Cloudflare R2 uploads (avatars, team logos) | [09 — Deployment](09_DEPLOYMENT.md) |
| `connection_manager.py` | WebSocket-per-Redis-channel fan-out | [02 — Architecture](02_ARCHITECTURE.md), [08 — API](08_API.md) |
| `match_scheduler.py` | Dormant Kafka pipeline orchestration | [02 — Architecture](02_ARCHITECTURE.md) |

## `app/api/` — HTTP surfaces outside the feature slices

- `v1/feed.py` — inbound feeder ingestion (`ingest_match_result` and friends). See
  [03 — Request Flow](03_REQUEST_FLOW.md), [05 — Simulation Engine](05_SIMULATION_ENGINE.md).
- `v1/transfers.py`, `v1/draft_roster.py`, `v1/waivers.py`, `v1/trades.py` — see
  [08 — API](08_API.md).
- `routes/websocket.py`, `routes/sse.py`, `routes/match.py` — realtime, async-DB
  routes. See [08 — API](08_API.md).

## `app/tasks/` — Celery

`celery_schedule.py` (the Beat schedule), `scoring_tasks.py`, `transfer_tasks.py`,
`pricing_tasks.py`, `sync_tasks.py`, `live_polling_tasks.py`. See
[06 — Algorithms](06_ALGORITHMS.md), [09 — Deployment](09_DEPLOYMENT.md).

## `app/adapters/`, `app/consumers/`, `app/workers/` — dormant Kafka pipeline

`adapters/base.py` (`ISportAdapter` interface), `adapters/football.py` +
`registry.py` (`ADAPTER_REGISTRY`), `consumers/` (normalizer, points_engine,
notifications), `workers/entry_points.py` (CLI entry points for each consumer
process). Gated by `REALTIME_PIPELINE_ENABLED`. See
[02 — Architecture](02_ARCHITECTURE.md) and [06 — Algorithms](06_ALGORITHMS.md) §10.

## `app/models/db/` — shared, cross-slice models

`live_event.py` (`LiveEvent`), `match_feed_cache.py` (`MatchFeedCache`). See
[07 — Database](07_DATABASE.md).

## `app/player/`, `app/match/`, `app/scoring/`, `app/user/`, `app/notification/`, `app/optimization/`

Each a standard vertical slice (`models.py`/`router.py`/`services.py`/`schemas.py`).
See [07 — Database](07_DATABASE.md) for their tables and [08 — API](08_API.md) for
their endpoints.

## `Sporty_Backend/alembic/versions/`

Every schema change, linear history. The most recent, feature-bearing migrations
(as opposed to routine column additions) are walked in detail in
[07 — Database](07_DATABASE.md): `f7a8b9c0d1e2_draft_roster_phase1`,
`a8b9c0d1e2f3_draft_roster_phase2`, `d5e6f7a8b9c0_add_lineup_starter_bench`,
`e6f7a8b9c0d1_dedupe_players`, `9aa8a1dd3a3d_add_match_feed_cache_table`.

## `sporty-frontend/src/`

Already walked layer-by-layer in [02 — Architecture](02_ARCHITECTURE.md) §3. Two
concrete examples worth knowing as templates for how a feature is built:

- **`features/create-team/`** — `useCreateTeamDashboard` (the feature hook) reads
  the league, the user's team, and a filtered player pool; wires build/draft/discard
  mutations and the draft-turn poll; validates with Zod via react-hook-form; branches
  on draft-vs-budget mode and single-vs-mixed sport shape. `CreateTeamView` is pure
  presentation over that hook — the intended shape for every feature module.
- **`components/live/LiveMatchClient.tsx`** — hydrates from the match-state
  snapshot, opens the WebSocket (`useMatchSocket`), and sets a 15-second
  re-hydrate fallback that self-heals a dropped socket. Renders phase-aware
  layouts (pre/live/post) from `ScoreTicker`, `EventFeed`, `LiveLeaderboard`,
  `LineupsCard`, `PredictionCard`, `RatingsCard`.

## `SportyDataFeeder/app/`

Walked in full mechanical detail in [04 — Models](04_MODELS.md) (the ML/statistical
layer: `features.py`, `ml_models.py`, `dixon_coles.py`, `rater.py`, `team_ratings.py`)
and [05 — Simulation Engine](05_SIMULATION_ENGINE.md) (`services/simulation.py`,
`routers/simulation.py`). The push layer (`services/backend_client.py`) and the
one-call demo orchestrator (`routers/demo.py`) are covered in
[03 — Request Flow](03_REQUEST_FLOW.md) and [06 — Algorithms](06_ALGORITHMS.md) §10.

## Explain Like I'm New

If the other chapters are "how does the engine work," this chapter is the map of
the garage — which bay each part lives in — so you know where to go read the
detailed manual for the part you actually care about.

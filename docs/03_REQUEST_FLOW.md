# 03 — Request Flow

This chapter traces exactly what happens for a request, end to end, naming real
files and functions at every step. See
[`diagrams/06_sequence_diagram.md`](../diagrams/06_sequence_diagram.md) and
[`diagrams/10_refined_sequence_diagram.md`](../diagrams/10_refined_sequence_diagram.md)
for the visual versions.

## A. A standard authenticated REST request (e.g. "set my lineup")

```
Browser
  │  PATCH /api/v1/leagues/{id}/my-team/lineup   (fetch via Axios, cookies attached)
  ▼
Client (sporty-frontend)
```

1. **Component** (`features/my-team/...`) calls a **hook**
   (`hooks/my-team/useUpdateLineup` or similar), which wraps `useApiMutation`
   (`hooks/api/useApiMutation.ts`).
2. The hook calls a **service** function (`LeagueService.updateLineup(...)`,
   `src/services/LeagueService.ts`), which is the only place that touches Axios. It
   uses the `authApi` instance (`src/api/auth-api-client.ts`) and an endpoint constant
   from `src/api/apiPath.ts` (`API_PATHS.LEAGUES.LINEUP` or equivalent) — URLs are
   never hard-coded.
3. **Request interceptor** (`auth-api-client.ts`) attaches the in-memory CSRF token
   (captured from a prior GET response) as `X-CSRF-Token`, and the browser
   automatically attaches the httpOnly `access_token`/`refresh_token` cookies (no
   token is ever read from JS).
4. If the server responds **401** (expired access token), a **response interceptor**
   triggers a de-duped `refreshAccessToken()` (a single shared promise so concurrent
   401s don't fire multiple refreshes), then retries the original request once
   (`_retry` flag prevents infinite loops). If refresh also fails, an
   `auth-invalidated` event fires (`src/lib/auth-events.ts`), which
   `context/auth-context.tsx` listens for to clear the user, drop all user-scoped
   client state (the whole React Query cache plus the persisted dashboard league
   selection — same cleanup as an explicit logout, so the next account on this
   browser never sees the previous user's cached data), and redirect to login.

```
        ▼  HTTPS
Sporty_Backend (FastAPI, app/main.py)
```

5. **Security headers middleware** (`app/middleware/security_headers.py`) — runs
   first (outermost), adds CSP/HSTS/X-Frame-Options/X-Content-Type-Options to the
   eventual response.
6. **CORS middleware** — checks `Origin` against
   `settings.get_cors_origins()` (environment-driven; also accepts Vercel preview
   subdomains via a regex), sets `allow_credentials=True` and exposes
   `X-CSRF-Token`/rate-limit headers so the frontend can read them cross-origin.
7. **CSRF middleware** (`app/middleware/csrf.py`) — this is a `PATCH`, a mutating
   verb, so it requires the `X-CSRF-Token` header and validates its hash against the
   Redis-stored value (`csrf:<hash>`, 1h TTL). Missing/invalid → `403` with a fresh
   token issued in the response header for retry. (Fails **open** — skips
   enforcement — if Redis is unreachable, logging a warning.)
8. **Rate limiter** (`app/middleware/rate_limiter.py`) — only enforced on
   auth endpoints by default; this route passes through untouched.
9. **Routing** — FastAPI dispatches to the matching path operation in
   `app/league/router.py`.
10. **Auth dependency** — `get_current_active_user` (`app/auth/dependencies.py`)
    reads the JWT from the `Authorization` header or the `access_token` cookie,
    decodes it (`app/core/security.py:decode_access_token`), loads the `User` row,
    and rejects deactivated accounts. League routes additionally depend on
    `require_league_member`/`require_league_owner` (`app/league/dependencies.py`).
11. **Pydantic validation** — FastAPI validates the request body against the
    route's Pydantic schema (`app/league/schemas.py`) before the handler body runs;
    a shape mismatch short-circuits with `422` before any business logic executes.

```
        ▼
Business logic (app/league/services.py:update_lineup)
```

12. **Service function** — `update_lineup` runs the actual business rules: confirms
    the target window isn't locked
    (`app/services/transfer_window_service.py:validate_transfer_window_for_lineup`),
    verifies every submitted player is on the caller's squad, runs structural
    validation (`validate_lineup_for_league_type`) and per-position validation
    (`validate_position_slots` against `LineupSlot` rows), and requires a distinct
    captain and vice.
13. **Models** — the service operates on SQLAlchemy ORM objects
    (`TeamGameweekLineup`, `TeamPlayer`, `LineupSlot`, all in `app/league/models.py`),
    reading through the **sync** session (`app/database.py:get_db` → `SessionLocal`).
    Per the transaction-ownership convention, the service issues `db.add`/`db.delete`
    calls but **never calls `db.commit()`**.

```
        ▼
Database (PostgreSQL)
```

14. The DB enforces its own guardrails independently of the service layer:
    `CheckConstraint`s (e.g. "at most one captain"), partial `UniqueIndex`es, and
    foreign keys. A constraint violation raises an `IntegrityError` that the service
    layer/router can catch or that propagates to the global exception handler.

```
        ▼  back up the stack
```

15. **Router commits** — the router (not the service) calls `db.commit()`, since it
    owns the transaction boundary for this request.
16. **Response** — FastAPI serializes the return value against the route's response
    model and sends it back with the `X-CSRF-Token` (if a GET issued a new one) and
    rate-limit headers attached by the middleware on the way out.

This particular request has **no background-worker step** — but the next section
covers the request type that does.

## B. A request that fans out to a background worker (transfer confirm → scoring is a later, separate flow — this example is "a match finishes")

The single most important trace in the system is a match finishing and becoming
leaderboard points, because it exercises validation, business logic, the model
layer, the database, **and** background workers in one path.

```
SportyDataFeeder (asyncio simulation loop)
  │ POST /api/v1/feed/match-result   (X-Feeder-Secret header, CSRF-exempt)
  ▼
Sporty_Backend  app/api/v1/feed.py : ingest_match_result
```

1. **Auth (server-to-server)** — `verify_feeder_secret` compares the
   `X-Feeder-Secret` header against `settings.FEEDER_SECRET` with
   `secrets.compare_digest` (constant-time); `503` if unset, `401` on mismatch. This
   endpoint is **exempt** from CSRF (no browser session to protect) and from the
   normal cookie-JWT auth entirely — it is a distinct trust boundary from user auth.
2. **Validation** — the request body is validated against the feed schema
   (`app/models/schemas/...` / inline Pydantic models in `feed.py`) before
   `ingest_match_result` runs.
3. **Business logic + idempotent upsert** — `ingest_match_result`:
   - finds the `Match` (by UUID id, then by `external_api_id`);
   - **idempotently upserts** the event batch into `live_events`
     (`INSERT ... ON CONFLICT (match_id, event_id) DO NOTHING`) — a feeder retry of
     the same minute never double-books;
   - updates `Match.home_score`/`away_score`/`status`, detecting the **live→finished**
     transition;
   - resolves player names for the batch and **publishes** a `SCORE_UPDATE`
     `WSMessage` to the Redis channel `{REDIS_PUBSUB_PREFIX}:{live_key}`;
   - calls `apply_live_points` (`app/services/feed_scoring.py`), which
     `HINCRBYFLOAT`s a Redis hash (`fantasy:match:{live_key}:player:{id}`) and
     publishes a `FANTASY_POINTS_DELTA` message per changed player;
   - **on the finish transition only**, calls `persist_match_stats` (folds
     `live_events` into `PlayerGameweekStat` + the sport child table), commits, then
     calls `enqueue_scoring_for_finished_match` — **best-effort**: a Celery/broker
     failure here is logged but does not fail the ingest request (a daily cron
     re-scores as a fallback).
4. **Models / database** — writes go through the same sync session/commit-ownership
   convention as any other router.

```
        │  Redis PUBLISH                              │  Celery send_task
        ▼                                              ▼
sporty-frontend (WebSocket)              Celery worker: score.transfer_window
```

5a. **Realtime fan-out (async path, no worker involved)** — the async WebSocket
    route (`app/api/routes/websocket.py`) holds a Redis pub/sub subscription per
    connected browser (`app/services/connection_manager.py`); every message
    published in step 3 is forwarded verbatim to the socket. The frontend's
    `useMatchSocket` hook dispatches it into the Zustand `matchStore`.

5b. **Background worker path** — `enqueue_scoring_for_finished_match`
    (`app/services/scoring/trigger.py`) locates the transfer window(s) covering the
    match date, throttles via a Redis `SET NX EX 300` key so a burst of finishes
    enqueues only once per window per 5 minutes, and sends the Celery task
    `score.transfer_window(window_id)` with `ignore_result=True`.
6. **Worker process** (a separate OS process running
   `celery -A app.core.celery_app.celery_app worker`) picks up the task. Because a
   worker process never runs `app/main.py`, `app/core/celery_app.py` re-imports every
   model module up front so the string-named cross-module relationships resolve.
7. **Business logic (worker)** —
   `score_transfer_window_for_season_leagues` (`app/services/scoring/engine.py`) runs,
   wrapped in a Redis lock (`lock:score:{league}:{window}`, 300s) so overlapping runs
   are skipped:
   - `score_football_players_for_window` / `..._nba_...` / `..._cricket_...`
     (`app/services/scoring/player_scoring.py`) — one `UPDATE ... FROM` per sport
     that rewrites every player's `fantasy_points` for the window directly in SQL;
   - `upsert_team_weekly_scores` (`app/services/scoring/team_scoring.py`) — computes
     each team's effective starting XI (running the auto-substitution logic in
     `app/services/scoring/auto_subs.py` for starters with 0 minutes), sums their
     points, applies the captain-doubles/vice-fallback rule, and writes
     `TeamWeeklyScore` via `INSERT ... ON CONFLICT ... DO UPDATE`;
   - `apply_rankings_for_league_window` (`app/services/scoring/ranking.py`) — sets
     `rank_in_league` via a SQL `RANK() OVER (ORDER BY points DESC)` window function;
   - invalidates the `leaderboard:{league}:{window}` Redis cache key.
8. **Database** — every one of the above is a bulk SQL statement, not a Python
   per-row loop; the worker's own transaction commits once at the end of
   `score_transfer_window_for_season_leagues`.

```
        ▼
Browser: GET /leagues/{id}/leaderboard
```

9. **Response** — the next leaderboard read (`app/league/services.py:
   get_league_leaderboard`) reflects the new `TeamWeeklyScore`/`rank_in_league` rows.
   If the on-finish enqueue in step 5b failed (broker outage), the periodic
   `score.active_transfer_windows` Beat task (every 10 minutes) or the daily 02:00
   `compute_and_store_rankings` APScheduler job catches it — three independently
   idempotent paths converge on the same answer. See
   [06 — Algorithms](06_ALGORITHMS.md) §5f, §9.

## C. Validation, in depth

Validation happens at **three layers**, deliberately redundant:

1. **Schema validation (Pydantic, at the FastAPI boundary)** — type/shape/required
   fields. Runs before any handler code executes; failures are `422`.
2. **Service-layer business validation (Python)** — the rules that can't be expressed
   as a static schema: "is this league in the right status?", "is this player
   actually on my squad?", "does this squad respect position minimums?". These raise
   domain exceptions the router maps to `400`/`403`/`404`/`409`.
3. **Database constraints (PostgreSQL, last line of defense)** — `CheckConstraint`,
   `UniqueConstraint`, partial unique indexes, and `ExcludeConstraint` (GiST) catch
   anything a service-layer bug might miss (e.g. two captains on one team, overlapping
   season date ranges). These are true invariants, not user-facing error messages —
   by the time one fires, it's a bug, not expected user input.

The ILP solvers (auto-pick, lineup optimizer) add a **fourth** kind: constraint
satisfaction as the actual algorithm (see [06 — Algorithms](06_ALGORITHMS.md) §1) —
an infeasible request is diagnosed in plain language
(`_diagnose_infeasible`) rather than surfaced as an opaque solver failure.

## Explain Like I'm New

Think of a request like a letter mailed through several checkpoints before it reaches
someone who can act on it, and several more on the way back. First a guard checks the
envelope isn't forged (CSRF), then checks you're not sending too many letters too fast
(rate limiting), then checks your ID badge (login token). Only then does the actual
"caseworker" (the service function) read the letter and decide what to do, consulting
the permanent records room (the database) and — for some letters, like "a match just
finished" — also paging a separate team (a Celery worker) to do slower follow-up work
in the background, so you don't have to wait for it before getting your receipt back.

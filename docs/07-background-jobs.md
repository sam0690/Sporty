# 07 — Background Jobs

Sporty has **three** background-processing systems. This chapter is the map of what runs where,
what each job does, and how duplicate runs are prevented.

| System | Where it runs | What it does | Gating |
|--------|---------------|--------------|--------|
| **APScheduler** | In-process, inside the FastAPI app (lifespan) | Daily/4-hourly maintenance crons | Always on |
| **Celery + Beat** | Separate worker + beat processes | Scoring, pricing, auto-lock, (external sync) | Always on (some tasks commented out) |
| **Kafka pipeline** | Separate consumer processes | Realtime event → points → notifications | `REALTIME_PIPELINE_ENABLED` (default off) |

## 1. APScheduler (`app/main.py` lifespan)

A `BackgroundScheduler` starts when the API boots. Each job opens its own `SessionLocal` and owns
its transaction. Jobs (all UTC):

| Job | Schedule | Function | Purpose |
|-----|----------|----------|---------|
| `daily_transfer_window_notifications` | 08:00 | `check_and_notify_open_windows` | Notify users of open transfer windows |
| `daily_league_lifecycle` | 00:00 | `auto_update_league_statuses` | SETUP→ACTIVE / ACTIVE→COMPLETED transitions ([04](04-leagues-and-lifecycle.md)) |
| `daily_cache_warming` | 00:05 | `warm_cache` | Pre-warm caches |
| `price_update_every_4h` | every 4h | `update_player_prices` | Demand+performance pricing ([06](06-scoring-ranking-pricing.md)) |
| `gameweek_ranking_update` | 02:00 | `compute_and_store_rankings` (for the active window) | Safety-net re-ranking |

The realtime Kafka producer + `MatchScheduler` are also started here **only if**
`REALTIME_PIPELINE_ENABLED` is true (it isn't by default).

## 2. Celery + Beat (`app/core/celery_app.py`, `app/tasks/`)

### Configuration

`celery_app` uses Redis as broker and result backend. Two important, hard-won config details:

- **Model imports up-front.** `celery_app.py` imports every model module (mirroring `main.py`)
  **before** configuring Celery. A worker process never runs `main.py`, so without this the first
  `db.query()` that touches a string-named relationship (e.g. `League → "User"`) fails with
  "failed to locate a name". This import block is required.
- **`task_ignore_result=True`.** Nothing in the codebase reads a task result back, and Upstash's
  Redis-over-TLS occasionally times out on the result-backend round-trip — which otherwise
  surfaces as a false "Task raised unexpected: TimeoutError" even though the DB work committed.
  Ignoring results globally removes that false-failure noise. (For `rediss://` broker/backend
  URLs, Celery additionally requires an explicit `?ssl_cert_reqs=CERT_REQUIRED` query param.)

### The task catalogue (`app/tasks/`)

| Task name | Module | What it does |
|-----------|--------|--------------|
| `score.transfer_window` | `scoring_tasks.py` | Score every league in a window's season (called on match finish) |
| `score.active_windows` / `score.active_transfer_windows` | `scoring_tasks.py` | Periodic scorer for currently-active windows |
| `transfer.auto_lock_expired` | `transfer_tasks.py` | Lock transfers whose `transfer_deadline_at` passed |
| `lineup.auto_lock_expired` | `transfer_tasks.py` | Lock lineups whose `lineup_deadline_at` passed |
| `pricing.recalculate` | `pricing_tasks.py` | Form-based repricing ([06](06-scoring-ranking-pricing.md)) |
| `sync.football.players` / `sync.football.matches` | `sync_tasks.py` | Pull rosters/fixtures from API-Football |
| `sync.stats.finished` / `sync.stats.live` | `sync_tasks.py` | Pull stats for finished/live real matches |
| `live.football.poll` / `live.nba.poll` / `live.cricket.poll` | `live_polling_tasks.py` | Real-API live pollers (gated by `LIVE_POLLING_ENABLED`) |

The sync/live tasks wrap **async** service coroutines and run them via `asyncio.run` (with a
fallback if a loop is already running).

### The Beat schedule (`app/tasks/celery_schedule.py`)

The schedule has been deliberately trimmed. **Active** entries:

| Beat entry | Schedule | Task |
|------------|----------|------|
| `score-active-transfer-windows-every-10-min` | 600s | `score.active_transfer_windows` |
| `auto-lock-transfer-windows-every-5-min` | `*/5 min` | `transfer.auto_lock_expired` |
| `auto-lock-lineup-windows-every-5-min` | `*/5 min` | `lineup.auto_lock_expired` |
| `recalculate-player-prices-daily` | 04:30 | `pricing.recalculate` (lookback 3) |

**Commented out** (left in place as literal `#`-prefixed lines): all the external-API sync tasks
(`sync.football.players/matches`, `sync.stats.finished/live`) and the live pollers
(`live.football/nba/cricket.poll`). Reasons captured in the file: the external APIs aren't needed
while the simulator is the data source, RapidAPI free-tier quotas (100 req/day) can't sustain a
tight interval, `LIVE_POLLING_ENABLED` is off anyway, and each auto-lock run costs a Redis
lock acquire/release against Upstash's command quota (so 5-min beats 1-min).

### Auto-lock (`app/services/transfer_window_service.py`)

`auto_lock_expired_transfers` / `auto_lock_expired_lineups` are idempotent: they find windows
whose deadline passed and whose lock flag is still False, flip it to True, and return counts. The
same module exposes `validate_transfer_window_for_transfer` / `..._for_lineup`, which the
transfer/lineup services call to reject edits past a deadline (checking both the explicit lock
flag and the deadline time).

### Running the workers

```bash
venv/bin/celery -A app.core.celery_app.celery_app worker --loglevel=INFO
venv/bin/celery -A app.core.celery_app.celery_app beat   --loglevel=INFO
```

In this deployment the worker + beat are run **locally** against the same production
PostgreSQL + Upstash Redis as the deployed API (to avoid paying for extra Render worker
instances). Because they share the DB and broker, they operate on live data.

## 3. Redis distributed locks (`app/core/redis_lock.py`)

Every periodic task that shouldn't overlap is wrapped in `redis_lock(key, ttl_seconds=...)`, a
context manager that:
- acquires via `SET key token NX EX ttl` (atomic, auto-expiring),
- yields `True`/`False` (a task that doesn't get the lock returns
  `{"skipped": True, "reason": "lock_held"}`),
- releases via a **Lua script** that only deletes the key if the stored token matches — so a task
  can never release another task's lock (important when a lock's TTL expires and a second worker
  re-acquires).

This is what makes "beat fired again while the last run is still going" safe, and what protects
scoring (`lock:score:transfer_window:{id}`), pricing, sync, and live polling.

## Why "gameweek scoring" fires from three places

The same `TeamWeeklyScore`/rankings can be produced by:
1. **On finish** — `enqueue_scoring_for_finished_match` → `score.transfer_window` (immediate).
2. **Periodic** — `score.active_transfer_windows` Beat task (every 10 min, active windows).
3. **Daily ranking** — the 02:00 APScheduler `compute_and_store_rankings` job (safety net).

All three are idempotent (locks + upserts + `RANK()`), so redundant runs converge on the same
answer. This layered redundancy is deliberate: if the on-finish enqueue fails (broker down), the
periodic/daily jobs still catch active windows.

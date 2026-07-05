# 11 — Performance

## Caching

- **Redis as the cache layer** — leaderboard results (`leaderboard:{league}:
  {window}`), player-price mirrors (`player:prices`), and the auto-pick candidate
  pool (per sport type, 30-minute TTL) are all cached in Redis rather than
  recomputed per request. The leaderboard cache is explicitly **invalidated** (not
  just left to expire) the moment new scores are written (`app/services/scoring/
  engine.py`) and again by the enqueue-throttle path — so readers never see a
  stale leaderboard for longer than the time between a score write and the next
  read.
- **24-hour TTL + durable fallback** for feeder-pushed prediction/ratings/lineups
  data: Redis is the fast hot-path read; `match_feed_cache` (PostgreSQL) is the
  backstop once a Redis entry expires, so a slow/cold read is still correct, just
  not as fast (see [07 — Database](07_DATABASE.md)).
- **No CDN-level API response caching** was found — static frontend assets get
  Vercel/Cloudflare edge caching by virtue of the hosting platform, but API
  responses are not cached at an edge/CDN layer.

## Batching over per-row work

The single most consistent performance pattern in the backend: **do the work in one
SQL statement, not a Python loop over rows.**

- **Gameweek scoring** (`app/services/scoring/player_scoring.py`) — one
  `UPDATE ... FROM` per sport rewrites every player's `fantasy_points` for a window
  in one round trip, rather than fetching N rows, computing in Python, and writing N
  rows back. For a window with thousands of player-stat rows this is the difference
  between one query and thousands.
- **Team weekly scoring** (`team_scoring.py`) — one query joins lineups to stats and
  aggregates per team; captain/vice logic is a SQL `CASE`, not a per-team Python
  loop.
- **Ranking** (`ranking.py`) — a single `RANK() OVER (...)` window-function query
  per league/window, not N queries to determine N teams' ranks.
- **Bulk user loading** — `services.start_draft` loads all league members' `User`
  rows in one query before creating their `FantasyTeam` rows, avoiding an N+1 query
  pattern (one query per member).

## Connection pooling

The sync SQLAlchemy engine (`app/database.py`) uses a **20+20** pool (20 persistent
connections + 20 overflow) with `pool_pre_ping=True` (a lightweight `SELECT 1`
before handing out a pooled connection, so a connection that died silently — e.g. a
managed Postgres provider's idle-connection reaper — is detected and replaced rather
than surfacing as a mid-request failure).

## Distributed-lock scoped work, not global locks

Redis locks (`app/core/redis_lock.py`) are scoped tightly — per `(league, window)`
for scoring, per `(user, league)` for auto-pick, per scheduler-job-name for
waiver/trade processing — rather than one global lock that would serialize unrelated
work. This means scoring league A's window 3 never blocks scoring league B's window
5, even though both go through the same code path and the same Redis instance.

## Avoiding N+1 in read-heavy endpoints

- **Trade roster listing** (`trade_service.get_league_rosters`) — one joined query
  across every team's active `TeamPlayer` rows plus `Player`, grouped in Python by
  team, rather than one query per team.
- **Match-state name resolution** (`app/api/routes/match.py:_resolve_player_names`)
  — one batched `SELECT ... WHERE id::text = ANY(:ids) OR external_api_id =
  ANY(:ids)` covering every player id needed for a match snapshot, instead of one
  lookup per event/player.

## Frontend caching and request efficiency

- **React Query (TanStack Query)** is the primary client-side cache: server data is
  fetched once per query key and reused across components until invalidated,
  eliminating duplicate requests for the same data within a session.
- **`AbortSignal` plumbing** (`useApiQuery`) lets in-flight requests be cancelled
  when a component unmounts or a dependency changes, avoiding wasted bandwidth and
  stale-response race conditions.
- **Zustand only for the live match** — everything else stays in React Query,
  avoiding a second, competing cache for server-derived state.
- **Standalone Next.js output** (`output: 'standalone'` implied by the Docker
  build's `.next/standalone` copy) ships a minimal server bundle rather than the
  full `node_modules` tree, reducing cold-start time and image size.

## Realtime efficiency

- **One HTTP push per simulated minute**, never per event — the feeder batches an
  entire minute's events into a single `POST /feed/match-result` call (see
  [05 — Simulation Engine](05_SIMULATION_ENGINE.md)), an explicit, commented design
  decision (`R-4.1 step 5`) rather than an accidental batching side-effect.
- **Redis pub/sub fan-out**, not per-client polling — every connected browser's
  WebSocket forwards messages from one Redis channel per match; the backend does
  one Redis `PUBLISH` regardless of how many browsers are watching, and Redis (not
  the API process) handles the fan-out to N subscribers.
- **`HINCRBYFLOAT`** for live fantasy-point accumulation — an atomic, O(1) Redis
  increment rather than a read-modify-write round trip from the application.

## Database-level performance features

- **Partial indexes** (e.g. `uix_team_player_active`, the draft-ownership unique
  index) — index only the rows that matter for the constraint/query (active
  rosters), keeping the index smaller and faster to maintain than a full-table
  index would be.
- **Numeric quantization** (`quantize_to_0.10` in the pricing services) keeps
  `players.cost` values from accumulating meaningless precision noise (a
  performance-adjacent correctness concern more than a raw speed one).
- **`ExcludeConstraint`/`RANK()`** — pushing set-based logic (overlap prevention,
  ranking) into the database's own query planner rather than fetching data into the
  application to compute it.

## Known, accepted performance/coverage trade-offs

- `score_active_transfer_windows` (the periodic scoring safety-net) only covers
  **currently active** windows by design — a deliberate scope limit, not a
  performance bug, documented directly in the code (see
  [03 — Request Flow](03_REQUEST_FLOW.md) and [06 — Algorithms](06_ALGORITHMS.md)).
- `task_ignore_result=True` on Celery is itself a performance/reliability trade
  specifically to avoid a documented false-failure mode against Upstash's
  TLS Redis (see [09 — Deployment](09_DEPLOYMENT.md)) — not a general
  "we don't care about task results" policy, but a targeted fix for one provider's
  behavior.

## Explain Like I'm New

The biggest performance idea in this codebase, repeated in a dozen places, is "ask
the database to do the heavy lifting in one big instruction, instead of asking it a
thousand small questions one at a time." Updating a whole gameweek's worth of
player scores is one SQL statement, not a thousand round trips — the database
engine is very good at doing that kind of bulk work efficiently, far better than an
application looping over rows one by one ever could be.

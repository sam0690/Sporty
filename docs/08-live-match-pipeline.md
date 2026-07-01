# 08 — Live Match Pipeline

This is how a match becomes data: ingestion of events, folding them into stat tables, computing
live per-event fantasy deltas, and streaming everything to the browser. There are **three**
possible event sources, all converging on the same `Match`/`LiveEvent`/Redis-pubsub model:

1. **The feeder** (current) — pushes to `/api/v1/feed/*`. Covered here + [10](10-sporty-data-feeder.md).
2. **Real-API pollers** (`LIVE_POLLING_ENABLED`, off by default) — pull from API-Football/API-NBA.
3. **The Kafka pipeline** (`REALTIME_PIPELINE_ENABLED`, off, not prod-tested) — the "designed for
   real scale" path.

The frontend live view doesn't care which source produced the data — it reads the same match
state endpoint and the same Redis-fed WebSocket. See [09](09-frontend-architecture.md) for the UI side.

## Source 1 — feeder ingestion (`app/api/v1/feed.py`)

Mounted at `/api/v1/feed`, server-to-server, authed by the `X-Feeder-Secret` header
(`verify_feeder_secret`: 503 if unset, 401 on mismatch via `secrets.compare_digest`, secret never
logged), CSRF-exempt. Endpoints:

- **`POST /schedule-match`** — registers a simulated fixture as a `Match` row. Idempotent on
  `external_api_id` (defaults to `feeder:<uuid5(home|away|date)>`). Returns the `sporty_match_id`
  the feeder must use in all later pushes.
- **`POST /register-players`** — creates a `Player` row per simulated player (idempotent on the
  feeder's `external_ref`), creating `RealTeam` rows as needed, and returns
  `{external_ref: player_uuid}`. Used for throwaway demos with feeder-owned players.
- **`POST /resolve-players`** — the **real-league** alternative: maps a feeder lineup onto players
  that **already exist** in the backend (the ones real users drafted), by **accent/diacritic-
  folded name** with `real_team` as a tiebreaker (`_fold_name`). Creates nothing; unmatched
  entries just don't score. This is how a simulated match can credit real users' fantasy teams.
- **`POST /match-result`** — the core push (below).
- **`POST /prediction`** / **`POST /player-ratings`** / **`POST /match-lineups`** — cache
  pre-match probabilities / post-match ratings / starting lineups in Redis with a 24h TTL
  (`prediction:match:{id}`, `ratings:match:{id}`, `lineups:match:{id}`), read by the realtime
  match routes.
- **`POST /demo-setup`** — idempotently ensures a demo user + league + open window + a fantasy
  team whose lineup is the given players, so a finished simulated match credits a *user's* total.

### The core: `ingest_match_result` (R-5.2 / R-5.5)

For each `/match-result` push (one per simulated minute), the handler:
1. Finds the `Match` (by UUID id, then `external_api_id`).
2. **Idempotently upserts** the batch's events into `live_events` via `INSERT ... ON CONFLICT
   (match_id, event_id) DO NOTHING` — so feeder retries/replays never double-book. `match_id`
   here is the **live key** (`external_api_id or str(match.id)`).
3. Updates `match.home_score`/`away_score`/`status`, and records whether this push is the
   **live→finished** transition (`finished_now`).
4. Resolves player names for the batch and **publishes a `SCORE_UPDATE`** `WSMessage` to the Redis
   channel `{REDIS_PUBSUB_PREFIX}:{live_key}` (default prefix `match`) — carrying score, minute,
   status, and the (name-enriched) events. This is what the WebSocket fans out to browsers.
5. Calls **`apply_live_points`** (see below) to push per-player fantasy deltas.
6. **On finish only:** calls `persist_match_stats` to fold the match's `live_events` into the stat
   tables, commits, then calls `enqueue_scoring_for_finished_match` (best-effort — a Celery
   failure here doesn't 500 the ingest; the daily cron re-scores). See [06](06-scoring-ranking-pricing.md).

## The scoring bridge (`app/services/feed_scoring.py`)

Because the Kafka pipeline is off and the gameweek engine only reads the stat tables, this module
bridges feeder events into both **live deltas** and **persisted stats**.

### Live per-event deltas — `apply_live_points`

Accumulates per-player point deltas for a minute batch, increments the Redis hash
`fantasy:match:{live_key}:player:{player_id}` field `points` (`HINCRBYFLOAT`), and publishes a
`FANTASY_POINTS_DELTA` `WSMessage` per changed player so the frontend PointsCard ticks up live.
The delta weights (`FOOTBALL_EVENT_POINTS`, `BASKETBALL_EVENT_POINTS`) **mirror the batch engine's
defaults** so the live numbers agree with the final gameweek totals:
- Football: goal +5, assist +3, yellow −1, red −2.
- Basketball: decomposed to match the per-10 NBA scheme — `point_2` = 0.6 (=2·3/10),
  `point_3` = 0.9, `free_throw` = 0.3, assist 0.2 (=1·2/10), rebound 1, steal 2, block 2.

### Persisting stats on finish — `persist_match_stats`

Runs **only on the live→finished transition** (the caller guards this — counts accumulate, so
re-running would double-book). It:
1. Aggregates the match's stored `live_events` into per-player event-type `Counter`s
   (`_aggregate_match_events`).
2. Finds the transfer window(s) covering the match date (`find_transfer_window_ids_for_datetime`).
3. Filters to players that actually exist in the backend (defensive against stale links).
4. For each window × known player: gets-or-creates the `PlayerGameweekStat` base row, adds
   `MATCH_MINUTES` (90 football / 48 basketball) to `minutes_played`, and folds the event counts
   into the sport child table:
   - football → `FootballStat.goals/assists/yellow_cards/red_cards`;
   - basketball → `NBAStat.points` (`point_2·2 + point_3·3 + free_throw`), `assists`, `rebounds`,
     `steals`, `blocks`.

After this, the gameweek engine (triggered next) computes `fantasy_points`, team scores, and
rankings exactly as it would for imported real-API stats. The `LiveEventLike` helper class gives
the real-API pollers a minimal `(sporty_player_id, event_type)` object to reuse `apply_live_points`.

## Source 2 — real-API pollers (off by default)

`app/services/sync/football_live_sync.py` and `nba_live_sync.py` are fully implemented but gated
by `settings.LIVE_POLLING_ENABLED` (returns a no-op string when off). When enabled, they **mirror
the feeder push path but pull instead of receive**. For football
(`sync_football_live_matches`): fetch live fixtures from API-Football, match each to an existing
`Match` by numeric `external_api_id`, fetch `/fixtures/events`, map API event `(type, detail)` to
internal types via `_EVENT_TYPE_MAP` (goal/yellow_card/red_card; own goals and missed penalties
are deliberately skipped), upsert `LiveEvent` rows, update score/status, publish `SCORE_UPDATE`,
call `apply_live_points`, and on finish call `persist_match_stats` + `enqueue_scoring_for_finished_match`.
Only **numeric** external ids are touched, so feeder rows (`feeder:<uuid>`) are never picked up —
the two sources can't collide over the same `Match`. NBA is analogous but matches players by
folded name + team (an ID-namespace mismatch: the roster catalog uses `nba_api` ids while live NBA
data uses API-NBA/RapidAPI ids) and diffs cumulative box-score snapshots (cached in Redis) into
synthetic `point_2/point_3/free_throw` events. Cricket live sync is an unimplemented stub.

## Streaming to the browser — Redis pub/sub → WebSocket / SSE

The realtime routes are under `/api` (not `/api/v1`) and use the **async** DB + Redis.

- **WebSocket** (`app/api/routes/websocket.py`): `GET /api/ws/match/{match_id}` and
  `.../ws/leaderboard/{match_id}`. Each subscribes the connection to a Redis channel
  (`{prefix}:{live_key}` or `leaderboard:{live_key}`) via the `ConnectionManager`
  (`app/services/connection_manager.py`), which owns a pub/sub listener task per socket and
  forwards every published message straight to the client (`send_text`). Metrics track active
  connections and messages sent.
- **SSE** (`app/api/routes/sse.py`): `GET /api/match/{match_id}/leaderboard/stream` — a
  `StreamingResponse` that subscribes to the leaderboard channel and yields `data: ...` frames.
- **Match state** (`app/api/routes/match.py`): `GET /api/match/{match_id}/state` is the
  authoritative **snapshot** the frontend hydrates from. It reads the DB match row, the stored
  `live_events` timeline (ordered by minute), the per-player point hashes
  (`fantasy:match:{key}:player:*`), and the cached starting lineups — resolving every player UUID
  to a display name server-side so the UI never renders raw ids. Also `.../prediction` and
  `.../ratings` return the feeder-cached JSON (enriched with names).

So the browser gets an authoritative snapshot on load (state endpoint), then live deltas over the
WebSocket (fed by Redis publishes from the ingest handler). If the socket drops, the frontend
re-hydrates from the snapshot every 15s.

## Source 3 — the Kafka pipeline (dormant)

Gated by `REALTIME_PIPELINE_ENABLED` (default False, **not prod-tested**). It's the "built for
real scale" design:
- **`MatchScheduler`** (`app/services/match_scheduler.py`) — started in the lifespan, polls the DB
  for `status="live"` matches and reconciles one **`IngestionWorker`** per live match, each using
  the sport's `ISportAdapter` (`app/adapters/`) to poll the provider and produce `RawEvent`s.
- **Adapters** (`app/adapters/football.py` etc., registered in `registry.py`) — normalize provider
  payloads to `NormalizedEvent`s, wrapped in a `pybreaker` circuit breaker + a Redis token-bucket
  rate limiter.
- **Consumers** (`app/consumers/`, run via `app/workers/entry_points.py`): a **normalizer**, a
  **points_engine**, and **notifications**. The `points_engine` consumes normalized events, dedupes
  by `points:dedup:{match}:{event}` (Redis `SET NX`), applies `app/scoring/rules.py:POINTS_RULES`
  (pure lambdas, e.g. football goal = 6 for a GK else 4), `HINCRBYFLOAT`s the per-player Redis hash,
  publishes `FANTASY_POINTS_DELTA` to the match channel and a `LEADERBOARD_DELTA` to the leaderboard
  channel (both with retry), forwards fantasy points to Kafka, and emits milestone notifications
  (hat-trick, century, triple-double). InfluxDB is used for time-series.

Note the pipeline uses the **same** Redis channels and the **same** `fantasy:match:*` hashes as the
feeder path, so the frontend works identically whichever is active. Its scoring lambdas
(`app/scoring/rules.py`) are a *separate* set of numbers from the feeder/batch weights — this is
the second scoring layer mentioned in [06](06-scoring-ranking-pricing.md), and it's only exercised
when the Kafka pipeline is enabled.

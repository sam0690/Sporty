# 06 — Scoring, Ranking & Pricing

This is the heart of the fantasy game: turning real match stats into fantasy points, rolling
them up into team scores, ranking teams, and moving player prices over time.

There are **two distinct scoring layers** in the codebase:
- **Batch/gameweek scoring** (`app/services/scoring/`) — the authoritative layer that reads the
  stat tables and computes per-player points, team weekly scores, and rankings. This is what
  the leaderboard shows. **This chapter is mostly about this layer.**
- **Realtime event scoring** (`app/scoring/rules.py`, consumed by the dormant Kafka
  `points_engine`) — pure lambdas mapping a normalized event to points, for live per-event
  deltas. Covered in [08](08-live-match-pipeline.md). The live per-event deltas that the feeder
  path actually uses are in `app/services/feed_scoring.py` and are deliberately tuned to agree
  with the batch layer's totals.

## Effective scoring rules (`app/services/scoring/rules.py`)

Before computing anything, the engine resolves the **effective** point value for each action.
`resolve_effective_rules(db, league_id, sport_id, actions, fallback_points)` returns an
`EffectiveRules(points_by_action)` where, for each action, the value is:

```
league override  →  platform default  →  hardcoded fallback  →  0
```

So a league owner's `LeagueScoringOverride` beats the platform `DefaultScoringRule`, which beats
a code fallback. This is one SELECT against each table and a merge.

## Per-player scoring (`app/services/scoring/player_scoring.py`)

For a (league, sport, window), the engine issues a single **SQL `UPDATE ... FROM`** that
rewrites `player_gameweek_stats.fantasy_points` for every player of that sport in that window,
computing points directly from the child stat table using the effective rules. There's one
function per sport:

- **Football** (`score_football_players_for_window`) — default weights (`FOOTBALL_ACTIONS`):
  ```
  points = goals·5 + assists·3 + yellow_cards·(-1) + red_cards·(-2)
  ```
  (goals/assists/cards come from `football_stats`; the `5/3/-1/-2` are the fallbacks, overridable
  per league.)
- **NBA** (`score_nba_players_for_window`) — a **fractional per-10** scheme:
  ```
  points = (points/10)·nba_points_10 + (assists/10)·nba_assists_10
         + rebounds·nba_rebound + steals·nba_steal + blocks·nba_block
  ```
  The per-10 divisions are done in SQL with a `cast(... , Numeric)` so integer division doesn't
  truncate. Default weights make ~10 game points and ~10 assists meaningful units.
- **Cricket** (`score_cricket_players_for_window`) — `runs·rule + wickets·rule + catches·rule +
  run_outs·rule + maidens·rule`, all `coalesce(..., 0)` because cricket stats are nullable.

There's also a pure-Python `compute_nba_fantasy_points(...)` mirroring the NBA SQL, used where a
non-SQL computation is convenient.

Each function returns the number of rows updated. Doing this in SQL (rather than row-by-row in
Python) is the key performance decision — one statement rewrites every player's points for the
window.

## Team weekly score (`app/services/scoring/team_scoring.py`)

`upsert_team_weekly_scores(db, league_id, transfer_window_id)` aggregates each team's **starting
lineup** into a single `TeamWeeklyScore.points`, entirely in SQL. The interesting parts:

1. **Eligible teams** — a subquery selects the league's active teams, honoring
   `LeagueMembership.eligible_from_window_id`: a member who joined at window K only counts from
   window K onward (compares the eligibility window's `number` to the current window's `number`).
2. **Lineup stats** — joins `team_gameweek_lineups` (this window's starters) to
   `player_gameweek_stats` to get each starter's `fantasy_points`, `minutes_played`, and
   captain/vice flags.
3. **Aggregate + captain/vice** — for each team: `base_points = Σ starter points`, and a SQL
   `CASE` implements the **captain/vice rule**:
   - if the captain **played** (`captain_minutes > 0`): add the captain's points again (captain
     scores double);
   - else if the captain did **not** play and the vice **did**: add the vice's points instead
     (the vice is the fallback captain);
   - else: add nothing.

   The same rule is expressed as a testable pure function `apply_captain_vice_bonus(...)`. The
   captain effectively **doubles** their points; the vice only kicks in when the captain gets 0
   minutes.
4. **Upsert** — writes one `TeamWeeklyScore` per team via `INSERT ... ON CONFLICT
   (fantasy_team_id, transfer_window_id) DO UPDATE`, resetting `rank_in_league` to NULL (it will
   be recomputed).

## Ranking (`app/services/scoring/ranking.py`)

`apply_rankings_for_league_window(db, league_id, transfer_window_id)` sets `rank_in_league`
using a SQL window function: `RANK() OVER (ORDER BY points DESC)` over that league+window's
`team_weekly_scores`, applied via `UPDATE ... FROM` a ranked subquery. `RANK()` semantics: ties
share a rank and the next rank skips (1,1,3). There's a pure-Python twin `compute_rank_map(...)`
for tests. `compute_and_store_rankings(window_id, db)` finds every league that has scores for a
window and ranks them all — this is what the **daily 02:00 APScheduler ranking job** calls as a
safety net.

## The scoring pipeline (`app/services/scoring/engine.py`)

`score_transfer_window_for_league(db, league_id, transfer_window_id)` is the orchestrator, wrapped
in a **Redis lock** (`lock:score:{league}:{window}`, 300s) so concurrent runs skip. It:
1. finds the league's sports,
2. runs the matching per-sport player-scoring UPDATE for each,
3. calls `upsert_team_weekly_scores`,
4. calls `apply_rankings_for_league_window`,
5. invalidates the leaderboard cache key (`leaderboard:{league}:{window}`).

Two wrappers scale this out:
- `score_transfer_window_for_season_leagues(db, transfer_window_id)` — scores **every league in
  the window's season** and commits once. This is what the `score.transfer_window` Celery task
  calls (the task enqueued when a match finishes).
- `score_active_transfer_windows(db)` — finds every window where `start_at <= now < end_at` and
  scores all their leagues. This is the **periodic safety net** (`score.active_transfer_windows`
  Celery Beat task, every 10 min).

> **Known gap (documented, accepted):** `score_active_transfer_windows` only covers **currently
> active** windows. If a match's window has already closed by the time its finish webhook fires,
> the immediate enqueue is the only chance to score it — the periodic sweep won't pick it up.
> This matters only when backfilling old fixtures into closed windows. It is a known, accepted
> limitation, not a bug to be silently fixed.

## Locating the window for a match (`app/services/scoring/window_locator.py`)

When a match finishes, the system must find which transfer window(s) cover its date.
`find_transfer_window_ids_for_datetime(db, match_date, sport_id)` returns every window where
`start_at <= match_date < end_at` (optionally filtered to the sport's seasons). This is used both
to book stats and to enqueue scoring (next section).

## Enqueue-on-finish (`app/services/scoring/trigger.py`)

`enqueue_scoring_for_finished_match(db, match_date, sport_id, league_id)` is called the moment a
match transitions to finished. It locates the covering windows, and for each one — throttled by a
Redis key (`score:enqueue:{window}`, 300s, `SET NX EX`) so a burst of finishes doesn't spam the
queue — sends a Celery task `score.transfer_window(window_id)` with `ignore_result=True`, then
invalidates the relevant leaderboard cache keys. It is **fire-and-forget and best-effort**: a
broker hiccup is logged (and the throttle released for retry) but never aborts the finish handler,
because the daily ranking cron re-scores as a fallback. Note the lazy import of `celery_app` — the
`trigger ↔ celery_app ↔ task modules` import cycle only resolves if `celery_app` loads first.

## League leaderboard (`app/league/services.py:get_league_leaderboard`)

`GET /leagues/{id}/leaderboard`. Two modes:
- **Specific window** (`window_id` or `gameweek=N`, resolved to the season's window): reads
  `team_weekly_scores` for that window, ordered by stored `rank_in_league` then points.
- **Season total**: `SUM(points)` across all windows, ordered descending; rank is the row index.

Both honor `eligible_from_window_id` (a late joiner's earlier windows don't count) and a
`historical` flag: `historical=True` (default) includes `LEFT` members so final/historical
standings preserve departed users; `historical=False` shows only active members.

## Dynamic pricing (two implementations)

Player `cost` moves over the season. There are **two** pricing services (both exist in the repo):

### 1. Form-based repricing (`app/services/pricing/repricing.py`)

`recalculate_player_prices(db, lookback_windows=3)` — the one wired to the daily
`pricing.recalculate` Celery task (04:30). For each player it computes a **recency-weighted
average fantasy-points** over the last N windows (newest window gets the largest weight;
`_window_weights` uses ranks `n, n-1, …` normalized), then moves the price toward that form:

```
raw_delta   = (weighted_points - baseline_points) · points_to_cost_factor
bounded      = clamp(raw_delta, -max_step_per_run, +max_step_per_run)
next_cost    = quantize_to_0.10( clamp(cost + bounded, min_cost, max_cost) )
```

Per-sport `PricingPolicy` parameters (`SPORT_POLICIES`): e.g. football baseline 6.0 pts, factor
0.15, ±1.50/run, cost bounds 4.0–20.0. Every change writes a `PlayerPriceHistory` audit row
(with `weighted_points` and `algorithm_version`). Prices are quantized to 0.1 increments for a
readable market.

### 2. Demand + performance blend (`app/services/price_update_service.py`)

`update_player_prices(db, redis)` — called by the APScheduler `price_update_every_4h` job. A
**hybrid** model: 70% **demand** (net transfers-in vs -out over the last 24h) + 30% **performance**
(average fantasy points, normalized), capped at ±0.10 per day:

```
demand_score      = (in - out) / max(1, in + out)
performance_score = (avg_points - 5) / 50
blended           = 0.70·demand_score + 0.30·performance_score
delta             = clamp(blended, ±0.10)
new_price         = quantize(cost + delta)   # floored at 0.10
```

It updates the DB first, then mirrors the new price into the Redis `player:prices` hash so the
transfer session reads consistent prices.

> Both pricing services exist; the form-based `repricing.py` is the one driven by Celery Beat
> (`pricing.recalculate`, daily 04:30), while the demand/performance blend is driven by the
> in-process APScheduler 4-hourly job. They're two different pricing philosophies over the same
> `players.cost` column — worth knowing when you see prices move.

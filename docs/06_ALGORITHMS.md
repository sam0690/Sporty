# 06 — Algorithms

Every non-trivial algorithm in the system: what it does, why this approach was
chosen over the obvious alternative, how it works, and its complexity. Each entry
names the exact file/function. See
[`diagrams/08_activity_diagram.md`](../diagrams/08_activity_diagram.md) for the
"where each algorithm fires along a gameweek" flow (previously embedded here as a
Mermaid diagram — moved to keep diagrams and prose separate per this doc set's
format).

## Contents

1. [Optimization — the two PuLP ILP solvers](#1-optimization--the-two-pulp-ilp-solvers)
2. [Snake draft ordering](#2-snake-draft-ordering)
3. [Scoring, auto-substitution, captain/vice, and ranking](#3-scoring-auto-substitution-captainvice-and-ranking)
4. [Pricing — two different models](#4-pricing--two-different-models)
5. [Draft-league roster management — waivers and trades](#5-draft-league-roster-management--waivers-and-trades)
6. [Live ingestion & the scoring bridge](#6-live-ingestion--the-scoring-bridge)
7. [Concurrency & infrastructure algorithms](#7-concurrency--infrastructure-algorithms)
8. [The feeder — match simulation](#8-the-feeder--match-simulation)
9. [The feeder — statistical/ML models](#9-the-feeder--statisticalml-models)
10. [Resilience patterns](#10-resilience-patterns)
11. [Head-to-head matchups — schedule generation & resolution](#11-head-to-head-matchups--schedule-generation--resolution)

---

## 1. Optimization — the two PuLP ILP solvers

Both solvers are **Integer Linear Programs (ILP — a mathematical optimization
problem: maximize/minimize a linear objective subject to linear constraints, with
some or all variables restricted to integers)**, solved with **PuLP** (a Python ILP
modeling library) using its bundled **CBC** (Coin-or Branch and Cut) solver.

**Why ILP at all?** Squad selection is a *constrained combinatorial* problem: "pick
the best 15 players under a budget, with at least 3 defenders, no more than 3 from
one club, exactly 8 football + 7 basketball…". A greedy "sort by value, take the top
N" heuristic fails because it can't simultaneously respect multiple constraints — it
might blow the budget or pick 6 goalkeepers. Brute force over `C(pool_size, 15)`
combinations is astronomically infeasible for realistic pool sizes (hundreds of
players). ILP's branch-and-bound search explores the space intelligently and returns
a **provably optimal** answer in milliseconds at this scale.

**Complexity:** ILP is **NP-hard** in general (0/1 knapsack with side constraints is
a classic NP-hard problem class) — worst-case exponential in the number of binary
variables. In practice, branch-and-bound with CBC solves problems of this size
(dozens to a few hundred binary variables, a handful of linear constraint families)
in well under a second, because the constraint structure (budget + small position/
club counts) prunes the search tree aggressively. Space complexity is linear in the
number of candidate players (one variable + a handful of constraint coefficients
each).

### 1a. Auto-pick squad — `app/league/auto_pick_service.py:auto_pick_ilp`

**What:** given a candidate pool and a league's sport config, suggest a complete,
valid squad (does not persist).

**How:**
- One binary variable `x_i ∈ {0,1}` per candidate.
- **Objective:** `maximize Σ jittered_value_i · x_i`, where `value_i` = historical
  average fantasy points ÷ cost (a "points per unit money" proxy, `PoolPlayer.value`).
- **Constraints:** `Σ x_i == squad_size`; `Σ cost_i·x_i ≤ budget + 1e-8` (epsilon
  absorbs float rounding); per-sport `Σ_{sport} x_i == quota`; per-position
  `Σ_{position} x_i ≥ minimum`; per-club `Σ_{club} x_i ≤ maxPerClub` (default 3);
  locked players forced `x_i == 1`.
- Solved with `PULP_CBC_CMD(msg=0)`; a non-`Optimal` status raises a descriptive
  `ValueError`. `validate_squad` re-checks the result as a defensive double-check.

**The jitter:** an ILP is deterministic — pressing "auto-pick" twice on the same pool
returns the exact same squad, which is poor UX for a "suggest me a team" button. Each
player's value is perturbed by a uniform random factor before solving:
`jittered_value_i = value_i · (1 + uniform(-0.55, 0.55))` (`AUTO_PICK_JITTER_STRENGTH
= 0.55`). This trades a small amount of optimality for variety on repeated presses,
while every result remains a hard-constraint-legal squad.

### 1b. Lineup optimizer with captain/vice — `app/services/optimization/ilp_optimizer.py:optimize_lineup`

**What:** a stateless endpoint (`POST /api/v1/optimization/lineup`) returning the
optimal squad **and** who to captain/vice.

**How:** three binary variables per player — `x_i` (selected), `c_i` (captain),
`v_i` (vice). Objective:
`maximize Σ [x_i·pts_i + c_i·pts_i + v_i·(pts_i·vice_multiplier)] − 0.000001·Σ cost_i·x_i`
— the captain's points count twice (`x` + `c`), so the solver *chooses* the captain
that maximizes total points rather than an arbitrary starter; the tiny cost term
breaks ties toward cheaper equally-good squads. Coupling constraints: `Σc_i == 1`,
`Σv_i == 1`, `c_i ≤ x_i`, `v_i ≤ x_i`, `c_i + v_i ≤ 1`.

**Infeasibility diagnosis:** a bare "infeasible" solver status is useless to an end
user. `_diagnose_infeasible` re-checks each constraint family in plain Python on
failure and returns a human reason ("Budget too low for minimum feasible squad",
"Insufficient players for required position 'GKP'", "Locked and banned player sets
overlap", …), turning an opaque failure into an actionable `422`.

---

## 2. Snake draft ordering

**Location:** `app/league/services.py:get_current_draft_turn` / `make_draft_pick`.

**What:** determine whose turn it is in a live draft, serpentine order.

**Why serpentine?** A fixed order (1..N every round) gives the first-pick manager a
permanent, compounding advantage. Reversing the order each round balances that out —
the standard fantasy-draft fairness mechanism.

**How:** for `N` members, `squad_size` rounds, overall pick number `p` (1-based):
```
round        = ((p - 1) // N) + 1
idx_in_round =  (p - 1) %  N
position     =  idx_in_round + 1        if round is ODD   (ascending 1..N)
             =  N - idx_in_round        if round is EVEN  (descending N..1)
```
The member whose `draft_position` equals `position` is on the clock. At
`p == N × squad_size`, the draft completes and the league auto-advances to `ACTIVE`.

**Complexity:** O(1) per turn lookup (pure arithmetic); O(1) per pick write (a few
row inserts/updates). Space: O(1) beyond the picks themselves, which are O(N ×
squad_size) total, an audit log by design.

---

## 3. Scoring, auto-substitution, captain/vice, and ranking

### 3a. Effective-rule resolution — `app/services/scoring/rules.py:resolve_effective_rules`

**What/why:** resolve the point value for a `(sport, action)` by precedence:
`platform default → hardcoded fallback → 0`. **How:** one SELECT over
`default_scoring_rules`, merged in Python. **Complexity:** O(1) per action (one
indexed lookup). *(Per-league overrides used to sit at the top of this chain but
were retired in 2026-07 — `fantasy_points` feeds league-unaware consumers like
auto-pick valuation and pricing, so scoring is platform-global now; see
[08 — API](08_API.md)/Scoring config.)*

### 3b. Per-sport fantasy-point formulas — `app/services/scoring/player_scoring.py`

**What/why:** convert raw stats into `fantasy_points` for a whole gameweek in a
**single SQL `UPDATE ... FROM`** per sport rather than a Python row loop — orders of
magnitude faster for thousands of rows, and atomic. **Formulas:**
- Football: `points = goals·5 + assists·3 + yellow·(−1) + red·(−2)`.
- NBA (fractional per-10): `points = (game_points/10)·w_pts + (assists/10)·w_ast +
  rebounds·w_reb + steals·w_stl + blocks·w_blk` (division done in SQL with an
  explicit `Numeric` cast so integer division doesn't truncate).
- Cricket: `runs·w + wickets·w + catches·w + run_outs·w + maidens·w`, each
  `coalesce(..., 0)` (cricket stat columns are nullable).

**Complexity:** O(n) in the number of player-stat rows for the window, executed as
one server-side statement (the database's own query planner, typically an index or
sequential scan over the window's rows — not `O(n)` round trips from the app).

### 3c. Formation-aware automatic substitution — `app/services/scoring/auto_subs.py:resolve_effective_lineup`

**What:** when a starter records 0 minutes for a gameweek, replace them in the
scoring calculation with the highest-priority bench player who **did** play — but
only if doing so keeps the resulting XI within the league's position min/max rules
(`LineupSlot`).

**Why:** real fantasy platforms don't let a manager's whole gameweek total collapse
to zero just because one starter was rested/injured and they forgot to change their
lineup; an *automatic* substitution mirrors that. The formation check matters because
a naive "swap in the next bench player regardless of position" could turn a valid XI
into an invalid one (e.g. subbing an outfielder in for an unavailable goalkeeper
would leave the team with zero keepers and too many outfielders).

**How** (pure, DB-free — operates on plain `LineupPlayer` dataclasses so it's
unit-testable without a database):
1. Partition the starting XI into `played` (minutes > 0) and `non_players`.
2. Sort the bench by `bench_order` (0 = first sub on); keep only bench players who
   themselves played.
3. For each non-playing starter, in order, try each remaining bench candidate: build
   the *trial* XI (starter removed, candidate added), recompute each constrained
   `(sport_id, position)` key's count, and accept the first candidate for which every
   constrained position stays within `[min, max]`. If no candidate keeps the XI
   legal, that starter is **not** substituted (stays in the XI scoring their zero).
4. Sum the resulting effective XI's points as the team's `base_points` for the
   captain/vice step below.

**Complexity:** O(S × B) in the worst case, where S = non-playing starters (≤ squad
starter count, typically ≤15) and B = played bench candidates (≤ bench size,
typically ≤4) — small, bounded constants in practice, so effectively O(1) per team
per gameweek.

### 3d. Captain-doubles / vice-fallback — `app/services/scoring/team_scoring.py`

**What/why:** the captain is a bet — their points double — but if the captain
records 0 minutes, the bet would return nothing, so the vice-captain is an automatic
backup (mirrors real fantasy-football rules). **How** (SQL `CASE`, mirrored by the
pure function `apply_captain_vice_bonus`):
```
final = base_points +
        captain_points   if captain_minutes > 0
        vice_points      elif captain_minutes == 0 and vice_minutes > 0
        0                otherwise
```
`base_points` already counts every effective starter once (after auto-subs); the
bonus adds the captain (or vice) a **second** time. Eligibility
(`eligible_from_window_id`) is applied in the same query.

### 3e. Ranking with SQL `RANK()` — `app/services/scoring/ranking.py`

**What/why:** the leaderboard is read constantly but ranks only change when scores
change, so rank is computed **once** after scoring and stored (compute-once,
read-many), not recomputed on every leaderboard GET. **How:**
`UPDATE ... FROM (SELECT id, RANK() OVER (ORDER BY points DESC) ...)`. `RANK()`
semantics: ties share a rank, the next rank **skips** (1, 1, 3). A pure-Python twin
`compute_rank_map` replicates this for tests. **Complexity:** the window function is
O(n log n) (a sort) over that league+window's team count — tiny (dozens of teams),
run once per league per window, not per read.

---

## 4. Pricing — two different models

Player `cost` drifts over the season via **two independent** algorithms writing the
same `players.cost` column.

### 4a. Form-based recency-weighted repricing — `app/services/pricing/repricing.py`

**Why recency-weighted:** price should reflect current form, not a season-long
average. **How:** take the last `N` windows (default 3), weight by rank (newest =
`n`, next = `n-1`, …, normalized to sum to 1 — a linear recency decay), compute the
weighted-average fantasy points, then:
```
raw_delta = (weighted_points − baseline) · points_to_cost_factor
bounded   = clamp(raw_delta, ±max_step_per_run)
next_cost = quantize_0.10( clamp(cost + bounded, min_cost, max_cost) )
```
Per-sport `PricingPolicy` sets `baseline`/`factor`/`max_step`/cost bounds. Every
change writes an immutable `PlayerPriceHistory` row. **Complexity:** O(players × N)
— linear in roster size times the lookback window (small, constant N=3).

### 4b. Demand + performance blend — `app/services/price_update_service.py`

**Why blend demand:** real markets move on popularity, not just performance. **How:**
```
demand_score      = (transfers_in − transfers_out) / max(1, in + out)      # last 24h
performance_score = (avg_fantasy_points − 5) / 50
blended           = 0.70·demand_score + 0.30·performance_score
delta             = clamp(blended, ±0.10)
new_price         = quantize(cost + delta)
```
Writes the DB first, then mirrors into the Redis `player:prices` hash so the
transfer-staging session reads consistent prices. **Complexity:** O(players) per run.

---

## 5. Draft-league roster management — waivers and trades

### 5a. Rolling waiver-priority resolution — `app/services/waiver_service.py:process_waivers_for_window`

**What:** once per gameweek (at the transfer deadline), resolve every pending
free-agent claim for that window.

**Why rolling order (not a fixed list, not FAAB bidding)?** This is the standard FPL
Draft mechanic: it guarantees every manager eventually gets priority again (a team
that just won a claim moves to the *back* of the queue), avoiding both the
"first-come-first-served chaos" of an unordered queue and the complexity of a
bidding-budget (FAAB) system.

**How:**
1. Load the league's `waiver_order` (team → priority position) and every `pending`
   claim for the window.
2. **Sort** claims by `(team's waiver priority, the team's own claim_priority among
   its multiple claims, submission time)` — so a higher-priority team's claims are
   resolved first, and within one team, the manager's own declared preference order
   wins.
3. Process in that order: re-validate the add/drop against the **current** DB state
   (`draft_roster_service.check_add_drop` — contested free agents are allowed at
   submission time; the first valid claim to be processed here wins, later
   conflicting claims fail with a stated `failure_reason`), apply the swap
   (`apply_add_drop`, writing a `RosterMove` audit row), flush immediately so
   **subsequent** claims in the same run see the updated ownership (preventing two
   different teams from both winning the same free agent).
4. **Rotate**: every team that won at least one claim this run moves to the back of
   `waiver_order`, in a two-phase renumbering (`_rotate_order`) that first pushes
   every row's `position` into a high, non-conflicting range (avoiding the
   `(league_id, position)` unique-constraint mid-update) before reassigning final
   sequential positions.

**Complexity:** O(C log C) to sort C pending claims for the window, then O(C) to
process them (each a small number of indexed queries); the rotation is O(T) in team
count. Driven by `process_due_waivers`, an APScheduler job that finds every window
whose `transfer_deadline_at` has passed and still has pending claims — idempotent,
since already-processed claims are no longer `pending`.

### 5b. Trade propose → accept → veto-window → execute — `app/services/trade_service.py`

**What:** manager-to-manager player swaps in draft leagues, with a commissioner
safety valve.

**Why a veto window instead of instant execution?** Real leagues need a way to catch
obviously lopsided or collusive trades before they're irreversible; a fixed
**24-hour** (`VETO_HOURS`) window after both sides agree gives a league
owner/commissioner time to intervene without requiring them to review every trade
proposal *before* the two managers can even agree to it.

**How (state machine on `trade_offers.status`):**
```
proposed --(other team accepts)--> accepted --(24h passes, no veto)--> executed
proposed --(either side)--------> cancelled
proposed --(other team)---------> rejected
accepted --(commissioner)-------> vetoed
```
`accepted` sets `veto_deadline = now() + 24h`; a scheduled job
(`finalize_due_trades`, hourly) finds `accepted` offers whose `veto_deadline` has
passed and executes them — an atomic ownership swap (`execute_trade`: release each
outgoing player's `TeamPlayer` row and re-add the incoming one, flushing
release-before-readd so the ownership partial-unique-index never sees a transient
double-booking) plus `RosterMove` audit rows for both sides. See
[07 — Database](07_DATABASE.md) for the `trade_offers` schema. Both the waiver and
trade scheduler jobs are wrapped in a Redis distributed lock
(`lock:draft:waiver_processing`, `lock:draft:trade_finalization`) so a
multi-instance scheduler deployment can't double-process the same window/trade.

**Complexity:** O(1) per trade (a small, fixed number of player swaps per offer);
the finalize job is O(T) in the number of due trade offers.

---

## 6. Live ingestion & the scoring bridge

### 6a. Idempotent event upsert — `app/api/v1/feed.py`

**What/why:** the feeder pushes one batch per simulated minute and may retry on a
network blip; the same event must never be double-counted. **How:**
`INSERT ... ON CONFLICT (match_id, event_id) DO NOTHING` — `event_id` is a UUID
minted once per event by the feeder, a stable idempotency key across retries/replays.
**Complexity:** O(batch size) per push, one statement.

### 6b. Live fantasy-delta accumulation — `app/services/feed_scoring.py:apply_live_points`

**What/why:** stream per-player point changes during a match so the UI ticks up
live, with weights tuned to **match** the batch engine's final totals (no jarring
correction at full-time). **How:** sum each player's deltas for the minute batch,
`HINCRBYFLOAT` the Redis hash `fantasy:match:{key}:player:{id}`, publish a
`FANTASY_POINTS_DELTA` per changed player. **Complexity:** O(events in the minute
batch).

### 6c. Event → stat folding — `feed_scoring.persist_match_stats`

**What/why:** on the live→finished transition (guarded to run exactly once — counts
accumulate, so a re-run would double-book), turn the raw event stream into permanent
stat rows. **How:** aggregate `live_events` into per-player `Counter`s, find the
covering transfer window(s), get-or-create each player's `PlayerGameweekStat`, fold
counts into the sport child table. **Complexity:** O(events in the match).

### 6d. Name folding + team-tiebreak matching — `feed.py:_fold_name` / `resolve_players`

**What/why:** the simulator and backend don't share player IDs, so a simulated
"N'Golo Kanté" must resolve to the real DB player. **How:** Unicode NFKD-decompose,
strip combining marks, lowercase, map special letters (`ø→o`, `å→a`, `æ→ae`, …); group
DB players by folded name; break name collisions with a folded `real_team` substring
match. The NBA live poller (`app/services/sync/nba_live_sync.py`) reuses this
technique for the same reason (different ID namespaces).

### 6e. NBA cumulative-stat diffing — `app/services/sync/nba_live_sync.py`

**What/why:** NBA box scores are cumulative totals, but the scoring pipeline needs
incremental events. **How:** cache the previous snapshot in Redis, subtract to get
the delta, then **greedily decompose** a point delta into `point_3`/`point_2`/
`free_throw` synthetic events (as many 3s as fit, then 2s, then free throws).

### 6f. Enqueue throttling — `app/services/scoring/trigger.py`

**What/why:** many matches can finish close together and each would otherwise
enqueue a duplicate scoring job for the same window. **How:** a Redis
`SET key val NX EX 300` throttle key per window; the first finish enqueues, the rest
suppress for 5 minutes (best-effort — a broker error releases the key for retry).

---

## 7. Concurrency & infrastructure algorithms

### 7a. Redis distributed lock — `app/core/redis_lock.py`

**What/why:** prevent two overlapping runs of the same scheduled job (Celery Beat
re-firing while the previous run is still going, or two worker processes racing).
**How:** acquire via `SET key token NX EX ttl` (atomic set-if-absent with
auto-expiry); release via a Lua script that deletes the key **only if its stored
value equals the caller's token** — so a lock whose TTL expired mid-run and was
re-acquired by someone else can never be deleted by the original (stale) holder.
This is the textbook-correct single-instance Redis lock pattern. **Complexity:**
O(1) acquire/release.

### 7b. Sliding-window rate limiting — `app/middleware/rate_limiter.py`

**What/why:** throttle brute-force/credential-stuffing on auth endpoints. **How:** a
Redis counter per `(ip, endpoint)`: `INCR`, `EXPIRE` on first hit; over-limit → `429`
+ `Retry-After`. **Fail-open** if Redis is down. **Complexity:** O(1) per request.

### 7c. CSRF double-submit with hashed tokens — `app/middleware/csrf.py`

**What/why:** cookie auth means the browser auto-attaches credentials, so a forged
cross-site POST would otherwise succeed without this. **How:** on GET, generate a
random token, store its **hash** in Redis (1h TTL), return the raw token in a
response header; mutating requests must echo it in `X-CSRF-Token`, validated against
the stored hash. Header-only (no CSRF cookie) so it works cross-origin without
`SameSite` friction. Auth endpoints are exempt (no session yet to hijack). Fail-open.

### 7d. 401 auto-refresh with a de-duped promise — `sporty-frontend/src/api/auth-api-client.ts`

**What/why:** on a 401, transparently refresh and retry — but ten simultaneous 401s
must not fire ten refresh calls. **How:** one shared `refreshPromise`; the first 401
starts it, every other 401 awaits the same promise, then each retries its own
original request once (a `_retry` flag prevents infinite loops).

### 7e. Live event merge/dedup — `sporty-frontend/src/store/matchStore.ts:mergeEvents`

**What/why:** the WebSocket can resend events, and the 15-second snapshot
re-hydrate overlaps the live stream. **How:** a `Set` of seen `event_id`s drops
duplicates; the timeline stays sorted by minute.

---

## 8. The feeder — match simulation

All in `SportyDataFeeder/app/services/simulation.py`. Full mechanical detail
(state machine, per-minute loop order, substitution timing, discipline) is in
[05 — Simulation Engine](05_SIMULATION_ENGINE.md); this section covers the
algorithmic core.

### 8a. Bernoulli per-minute event sampling — `_sample_minute_events`

**What/why:** decide, per on-court player per event type per minute, whether that
event fires — each minute is an independent trial, so summed over 90/48 minutes the
event count is approximately Poisson-distributed, which is realistic, rather than a
scripted count. **How:** for each player, for each event type with per-minute
probability `p` (clamped to `[0,1]`), draw `numpy.random.binomial(1, p)`; fire if 1.
**Complexity:** O(players × event types) per minute — small, fixed (≤16 on-court ×
handful of event types).

### 8b. Home/away scoring calibration — `calibrate_scoring_rates`

**What/why:** raw per-player rates don't guarantee a realistic scoreline;
calibration scales **scoring-event** rates so each side's *expected* score matches
its real league average, scaled independently per side — which is precisely what
bakes in home advantage. **How:** `factor = real_target / (total_minutes · Σ
scoring_rate(player on side))`, applied uniformly within a side (so each player
keeps their share of the scoring, only the level moves). Football targets 1.55 home
/ 1.25 away goals; basketball 104.9 / 102.2 points.

### 8c. Coupled assist model — `_pick_assister`

**What/why:** an assist only exists because a teammate scored — sampling it
standalone would produce orphan assists. **How:** never sample "assist" directly;
when a scoring event fires, credit a teammate with probability `ASSIST_PROBABILITY`
(0.75 football / 0.58 basketball), chosen via a weighted random draw
(`numpy.random.choice`) over teammates' own assist rates (playmakers assist more).

### 8d. Substitution timing & rotation — `_draw_sub_minutes`, `_football_substitutions`, `_basketball_rotation`

Covered in full in [05 — Simulation Engine](05_SIMULATION_ENGINE.md) §"Substitutions
and rotation."

### 8e. Discipline (cards) state machine — `_apply_discipline`

Covered in full in [05 — Simulation Engine](05_SIMULATION_ENGINE.md) §"Discipline."

### 8f. Overtime resolution

**What/why:** basketball has no draws. **How:** if regulation ends tied, play
repeated 10-minute overtime periods (each a continuation of the same per-minute
loop) until broken, capped at 6 periods (`MAX_OVERTIME_PERIODS`) as a safety valve.

---

## 9. The feeder — statistical/ML models

Covered in full detail in [04 — Models](04_MODELS.md); referenced here for
completeness of the algorithm index: EWMA form index, logistic regression outcome
model v1, Elo + logistic outcome model v2, Dixon-Coles bivariate-Poisson goal model,
rule-based post-match ratings.

---

## 10. Resilience patterns

- **Retry with exponential backoff** — `SportyDataFeeder/app/services/
  backend_client.py` (push: 3 attempts, delay `1.5ⁿ`) and
  `app/consumers/points_engine.py` (Redis/Kafka publish: delay `0.15·2ⁿ`). Both are
  non-fatal: exhausted retries log and return `False`; the simulation/pipeline keeps
  going and events persist locally for later replay (`POST /matches/{id}/replay-push`
  on the feeder).
- **Circuit breaker** (`pybreaker`) + **token-bucket rate limiter** (Redis) in the
  external-API adapters (`app/adapters/football.py`, dormant Kafka pipeline). After N
  consecutive failures the breaker opens and fails fast for a cooldown instead of
  hammering a dead API, then half-opens to test recovery; the token bucket caps
  average request rate against a provider's quota while allowing short bursts.
- **Fail-open middleware** — CSRF and rate-limiting both allow the request through
  (logging a warning) if Redis is unreachable, prioritizing availability over
  enforcement for these two concerns specifically (contrast with the auth *token*
  check, which fails **closed**).
- **Idempotency keys everywhere** — UUID `event_id` on every simulated event,
  `ON CONFLICT DO NOTHING` ingestion, Redis-throttled enqueue keys, Redis dedup in
  the (dormant) points engine — retries, replays, and overlapping jobs converge on
  the same state instead of double-counting.
- **Layered redundancy for scoring** — the same `TeamWeeklyScore`/rankings can be
  produced on-finish, by a 10-minute periodic sweep, and by a daily ranking cron —
  all idempotent, so a failure in one path is caught by another (see
  [03 — Request Flow](03_REQUEST_FLOW.md)).

## 11. Head-to-head matchups — schedule generation & resolution

**Location:** `app/services/matchup_service.py` (full design writeup:
`Sporty_Backend/docs/HEAD_TO_HEAD_MATCHUPS.md`).

**What:** an opt-in league format (`League.is_head_to_head`, orthogonal to
draft/budget mode — it changes nothing about squads, transfers, waivers, or
trades). Each transfer window every team is paired against one opponent; whoever
scores more fantasy points that window (per the already-computed
`TeamWeeklyScore`) records a win. Standings are a W-L-T record instead of (well,
alongside) cumulative points.

**Schedule generation — circle-method round robin
(`generate_round_robin_rounds`):** fix the first team, arrange the rest in a
circle, and rotate the circle one step per round. For `n` teams this yields
`n-1` rounds of `n/2` pairs where every team meets every other team exactly
once. An **odd** team count is padded with a `None` slot — whoever is paired
with `None` that round has a **bye** (its matchup row is written with
`result="bye"` immediately). If the season has more gameweeks than rounds, the
schedule cycles (`rounds[i % len(rounds)]`), so teams meet again in the same
order. Complexity: O(n²) pairs total — trivially small at league scale.

**When it runs:** exactly **once**, at the league's transition to `ACTIVE`
(three call sites converge on the same idempotent function: draft completion in
`draft_service.py`, a manual status change in `league_service.py`, and the daily
lifecycle job in `league_status_service.py`). The schedule is never regenerated
— `is_head_to_head` is **mutually exclusive** with `allow_midseason_join`
(enforced at creation and on toggle), because a mid-season joiner would silently
rewrite other teams' future opponents.

**Resolution (`resolve_matchups_for_window`):** after the batch scoring engine
writes a window's `TeamWeeklyScore` rows, `engine.py` calls this per league:
compare `home_points` vs `away_points` → `home_win`/`away_win`/`tie`. A matchup
where either side's score hasn't landed yet is skipped (its `result` stays
`NULL`), so the next scoring pass naturally retries it — resolution is
idempotent and requires no separate scheduler.

**Standings (`get_h2h_standings`):** sort by **wins desc, then points-for desc**
(the locked tiebreaker; points-against is tracked and displayed but never used
to sort). Byes count as neither a win nor a loss, and every active team appears
even at 0-0-0.

## Explain Like I'm New

Most of the "smart" parts of this system aren't AI — they're careful, well-chosen
math. Picking a legal, good fantasy squad under a budget is the same kind of problem
as "pack a suitcase to maximize value without exceeding the weight limit," which
computers solve extremely well with a technique called integer linear programming
(a solver tries combinations intelligently instead of one by one). The rest is mostly
disciplined bookkeeping: making sure the same event is never counted twice
(idempotency), making sure two processes never step on each other's toes at the same
time (locks), and making sure a temporary hiccup (a dropped network call) doesn't
silently lose data (retries + replay).

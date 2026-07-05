# 05 — Simulation Engine

This is a complete deep dive into `SportyDataFeeder/app/services/simulation.py`
(808 lines) — the code that plays out a football or basketball match minute by
minute and pushes the results to the Sporty backend. Every claim below is grounded
directly in this file (and `app/routers/simulation.py` for the HTTP contract), read
in full for this chapter. See
[`diagrams/07_state_diagram.md`](../diagrams/07_state_diagram.md) for the
match/simulation state machine and
[06 — Algorithms](06_ALGORITHMS.md) §8 for the algorithmic summary this chapter
expands on.

## What starts a simulation

`POST /simulate` (`app/routers/simulation.py:start_match_simulation`) accepts either
an existing `match_id`, or `home_team_id` + `away_team_id` + `sport_id` (creating a
new `scheduled` `Match` row on the fly). It rejects a second simulation for a match
already running (`409`), resolves the sport, optionally links the match/teams to
Sporty backend UUIDs (`entity_links`), then calls `start_simulation(...)` and returns
**`202 Accepted`** immediately with `{match_id, status: "running", status_url}` — the
actual simulation runs as a **background `asyncio.Task`**, not inline in the request.
Callers poll `GET /simulate/{match_id}/status` or `GET /simulate` (all known
simulations, for the admin panel) for progress, and can request an early, graceful
stop via `POST /simulate/{match_id}/stop`.

## Inputs

- `event_rates` — the trained `{player_id: {event_type: per-minute probability}}`
  dictionary loaded from `event_rates.pkl` at app boot into `app.state.event_rates`
  (see [04 — Models](04_MODELS.md)); passed through to `start_simulation` by the
  router.
- `featured` — an optional list of player-name substrings (a demo affordance: "make
  sure this specific drafted player registers a stat").
- The match's two rosters (`Player` rows filtered by `team_id`), read fresh from the
  feeder's own database at simulation start.

## Random seed and reproducibility

**There is no random seed set anywhere in this module or its call path** (confirmed
by inspection — no `numpy.random.seed(...)` or `random.seed(...)` call exists in
`simulation.py`, and none was found via a repository-wide search of the feeder's
`app/` tree). Every simulation uses NumPy's global default random state, which is
seeded from OS entropy at process start and mutates with every draw. **Consequence:
simulations are not reproducible.** Running the same match twice (same teams, same
`event_rates`) will produce a different minute-by-minute script and, generally, a
different final score every time. This is a deliberate product fit (variety is
desirable for a demo/game) but also means there is no way to replay an *identical*
simulation for debugging — only the event log of an already-run simulation can be
replayed (`POST /matches/{id}/replay-push`), not a fresh run with the same random
outcome. See [14 — Improvements](14_IMPROVEMENTS.md).

## State machine

Two related but distinct status fields exist:

- **`SimulationState.status`** (in-process only, held in the module-level
  `_simulations: dict[match_id, SimulationState]` registry — lost on process
  restart): `running → finished` (completed normally) `| stopped` (a
  `POST /simulate/{id}/stop` was honored after the current minute) `| error`
  (an unhandled exception; the exception message is captured in `state.error` and
  the loop never re-raises — "never raises" is a direct design goal stated in the
  module's own comments).
- **`Match.status`** (persisted in the feeder's database): `scheduled` (before
  simulation starts) `→ live` (set the instant the loop begins, **and pushed to the
  Sporty backend immediately**, before any events exist — this is a deliberate fix:
  without an immediate "kickoff" push, the Sporty-side match would appear stuck on
  "scheduled" until whichever minute happens to produce its first event) `→
  finished` (normal completion or a requested stop — both set `Match.status =
  "finished"`) `| error` (the exception handler tries to persist this back to the
  DB in a fresh transaction if the main one had to roll back).

See `diagrams/07_state_diagram.md` for the visual state machine covering both
levels plus the Sporty-side `Match.status` values it drives.

## Initialization (`_prepare`)

1. **Resolve the match and sport.** Raises immediately (caught by the outer
   `run_simulation` try/except, which marks the state `error`) if the match or a
   recognized sport can't be found.
2. **Select lineups** (`_select_lineup`): the on-court/on-pitch group size is
   **11 for football, 5 for basketball** — deliberately *not* the full 10-man
   basketball roster, because running 10 players for the full 48 minutes would
   double real on-court minutes and inflate every basketball stat roughly 2×. Player
   selection is "lowest player id first," **except** any name matching the
   `featured` list (accent/case-folded substring match, via `_fold_name`) is pulled
   in ahead of the rest — so a specific demoed/drafted player is guaranteed to play.
3. **Select the bench**: the remaining roster, capped at `BENCH_SIZE` (**9 for
   football**, mirroring real EPL squads naming 9 substitutes even though only 5 may
   be used in a match; **5 for basketball**, an approximation of a realistic playing
   rotation beyond the starting 5).
4. **Assign per-player event rates**: look each on-court/bench player up in
   `event_rates`; a player with no trained rates (a "cold start") gets the
   sport's league-average fallback (`FOOTBALL_FALLBACK_RATES`/
   `BASKETBALL_FALLBACK_RATES` from `features.py`) and is logged as a warning
   (aggregated as one "N/M players cold-started" log line, not one line per player).
5. **Calibrate scoring rates** (`calibrate_scoring_rates`, only if
   `SIMULATION_CALIBRATE` is enabled): scales **only** the scoring-event rates
   (`goal` for football; `point_2`/`point_3`/`free_throw` for basketball) so each
   side's *expected* total (`total_minutes × Σ per-player scoring rate`) matches its
   real league home/away average — **football 1.55 home / 1.25 away goals;
   basketball 104.9 home / 102.2 away points**. Home and away scale **independently**
   by their own factor, which is precisely what bakes in home advantage; the factor
   is uniform across all players on one side, so each player's *share* of the
   scoring is unchanged, only the overall level moves. Non-scoring events (cards,
   assists as a category, rebounds) are left completely untouched by calibration.
6. **Bench calibration inheritance**: bench players' scoring rates are scaled by
   their **own team's** calibration factor too (computed from the starting lineup,
   not recomputed per-substitute), so a substitute scores at the same calibrated
   level as the starter they replace — the on-pitch/on-court player *count* never
   changes, so the expected scoring level for the team stays anchored to the league
   average throughout the match regardless of who's actually on the field at any
   moment.
7. **Featured-player floor** (`FEATURED_RATE_FLOOR`, applied **last**, after
   calibration, so it isn't scaled back down): raises a featured player's primary
   scoring-event probability to a **floor** — football `goal ≥ 0.03` per minute
   (expected ≈ `0.03 × 90 ≈ 2.7` goals across the match, making a goalless match for
   that player vanishingly unlikely), basketball `point_2 ≥ 0.06` / `point_3 ≥
   0.03`.
8. **Entity-ID mapping**: loads `entity_links` rows mapping feeder integer ids
   (match, both teams, every lineup+bench player) to Sporty backend UUID strings. If
   the match itself has no link, every push for this match is **skipped** (logged as
   a warning suggesting `POST /links` + `replay-push` later) rather than failing the
   simulation — events still accumulate locally.

## The per-minute loop (`play_minute`, driven by `run_simulation`)

For each minute `1..total_minutes` (90 football / 48 basketball), in this exact
order:

1. **Substitutions/rotation first** — `_football_substitutions` (football) or
   `_basketball_rotation` (basketball) run **before** event sampling, so a player who
   comes on at minute `m` is eligible to register an event *in* minute `m` (a
   same-minute cameo goal is possible by construction, matching how a real
   super-sub can score seconds after coming on).
2. **Event sampling** — `_sample_minute_events` (see below) draws this minute's
   events from the **post-substitution** lineup.
3. **Discipline applied last** — `_apply_discipline` processes any cards *just
   generated* in step 2 (second yellow → red, sending a player off with **no
   replacement** — the team plays a player short for the remainder, no substitution
   is permitted for a red card, mirroring the real laws of the game).
4. **Clocks advance** — `_advance_clocks` increments every on-pitch/on-court
   player's `minutes_played` counter, and (basketball only) each team's per-player
   stint/rest counters that drive the next rotation checkpoint.
5. **Persist + score** — every fired event this minute is written to the feeder's
   local `events` table (with a freshly minted UUID `event_id`), the running
   `home_score`/`away_score` is updated via `event_score_value(...)` (from
   `scoring_rules.py` — goals/points only; cards and assists never carry a score
   value), and the DB transaction commits.
6. **One HTTP push per minute** — if any events fired this minute (and the match has
   a resolved backend link), the **entire minute's batch** is sent to the Sporty
   backend in a **single** `POST /feed/match-result` call — never one HTTP call per
   event. A failed push increments `state.push_failures` but does not stop the
   simulation (events persist locally regardless; see
   [06 — Algorithms](06_ALGORITHMS.md) §10 "Resilience patterns").
7. **Pace the loop** — `await asyncio.sleep(SIMULATION_SPEED)` (a config value; `0`
   runs at maximum speed for demos/tests, a higher value paces the simulation to
   feel closer to real time).

### Event generation — Bernoulli sampling (`_sample_minute_events`)

For **every** on-pitch/on-court player, for **every** event type in that player's
rate dictionary (except `"assist"`, which is never sampled directly — see below):
draw `numpy.random.binomial(1, p)` where `p` is that player's per-minute probability
for that event type (clamped to `[0, 1]`); the event fires if the draw is 1. Each
player-minute-event-type combination is an **independent Bernoulli trial** — over 90
(or 48) minutes this produces an approximately Poisson-distributed total event count
per player, which is what makes match event counts look statistically realistic
(variable, occasionally streaky) rather than a fixed script.

### Coupled assist model

Assists are **never** sampled as their own Bernoulli event — the code explicitly
skips `event_type == "assist"` in the main sampling loop. Instead, whenever a
scoring event fires (`goal` for football; `point_2`/`point_3` for basketball — free
throws are excluded, since a free throw is never assisted in real basketball), a
**separate** Bernoulli draw with probability `ASSIST_PROBABILITY` (**0.75** football,
**0.58** basketball — both stated as real-data-derived rates) decides whether that
score gets an assist at all. If so, `_pick_assister` chooses **one teammate** (never
the scorer) via a **weighted random draw** (`numpy.random.choice`) where the weight
is that teammate's own assist rate (with a `1e-4` floor so a zero-rate teammate still
has a nonzero, negligible chance) — so a team's most creative players end up
credited with more assists, and not every goal has an assist (solo efforts are
represented naturally by the ~25%/42% of scoring events that don't draw an assist).

## Substitutions and rotation

The two sports are modeled with **deliberately different** substitution mechanics,
matching how each sport actually behaves:

### Football — permanent, timed substitutions (`_football_substitutions`)

- Up to **`FOOTBALL_MAX_SUBS = 5`** substitutions per team (real modern football
  rule), limited further by however many bench players are available.
- **Substitution minutes are pre-drawn** at the start of the match
  (`_draw_sub_minutes`), not decided reactively: for each of the `min(5,
  bench_size)` planned subs, a uniform random roll decides which "phase" it falls
  into —
  - **8% chance** (`SUB_FIRST_HALF_PROB`): a random minute in the first half
    (minute 20 to half-time) — modeling an early injury/tactical emergency.
  - **25% chance** (`SUB_HALF_TIME_PROB`): exactly at half-time + 1 minute — the
    classic half-time substitution burst.
  - **remaining 67% chance**: a random minute between (half-time + 10) and
    (full-time − 5) — the realistic bulk window for tactical/fitness substitutions
    (roughly the 55th–85th minute for a 90-minute match).
  The drawn minutes are sorted ascending and consumed in order as the match clock
  passes them.
- **Who comes off**: a random **outfielder** (position string not starting with
  `"G"`) from the currently-active lineup, **excluding** featured/demo players and
  anyone already sent off. If no eligible outfielder exists, the exclusion is
  relaxed (first drop the "not featured" filter, then — if still nobody — allow
  anyone active) so a substitution can still happen rather than silently skip.
- **Who comes on**: a **uniformly random** bench player (not priority-ordered).
- **Permanence**: a substituted-off player is removed from `setup["lineups"]`
  entirely (`_swap_players`) — football substitutes **do not return**, matching the
  real laws of the game.
- **Event emitted**: `"substitution"`, attributed to the player **coming on**, with
  `extra: {player_out: id, player_out_name: name}` and `related_player_id` set to
  the outgoing player's id — this is what lets the Sporty backend publish a
  `LINEUP_CHANGE` WebSocket message identifying both players involved.

### Basketball — rotating stints, not permanent subs (`_basketball_rotation`)

- **No pre-planned substitution minutes.** Instead, a **rotation checkpoint** fires
  every `BASKETBALL_ROTATION_INTERVAL = 4` simulated minutes (skipping minute 1).
  At each checkpoint, each team swaps **1–2** players (a uniform random count up to
  `min(2, bench_size)`).
- **Who comes off**: the player (excluding featured players, unless no one else
  qualifies) with the **longest current stint** (`team["stint"][player_id]`, reset
  to 0 whenever they come on), ties broken toward the higher player id.
- **Who comes on**: the **most-rested** bench player (`team["rest"][player_id]`,
  reset to 0 whenever they go off), ties broken the same way.
- **Return capability**: unlike football, a player subbed off in basketball is
  placed **back onto the bench pool** (not removed from the match) — the same
  player can be rotated back on later, which is exactly how real NBA rotations
  work. Over a 48-minute simulated game this produces roughly **30–40 substitution
  events** with starters landing in the **mid-30s total minutes**, both cited in the
  code's own comments as close to real NBA box-score patterns.
- **Event emitted**: same `"substitution"` event shape as football (player-on +
  `related_player_id` = player-off).

## Discipline (cards) — a small state machine, football only (`_apply_discipline`)

Cards themselves are **sampled events**, not a separate hand-written mechanic —
`yellow_card` and `red_card` are ordinary entries in each player's `event_rates`/
fallback-rates dictionary (fallback rates: **yellow ≈ 0.002/min, straight red ≈
0.00007/min** per `features.py:FOOTBALL_FALLBACK_RATES`, chosen to be "close to
real-world frequency" per the code's own comment) and are fired by the same
Bernoulli sampling pass as goals/assists. What `_apply_discipline` adds, applied
**after** sampling each minute, is the *consequence* logic:
- The **first** yellow for a player in a match is recorded in a per-match `yellows`
  set — no immediate consequence.
- A **second** yellow for the same player is converted into a **derived red card**
  (`event_type: "red_card", extra: {reason: "second_yellow"}`), appended to that
  minute's event list, and the player is added to a `sent_off` set.
- Any **straight red** (sampled directly as `"red_card"`) also adds the player to
  `sent_off`.
- Every player in `sent_off` is **removed from the active lineup** at the end of
  processing that minute (`setup["lineups"][:] = [...]`) — the team plays the rest
  of the match a player short, with **no replacement permitted** (correctly mirrors
  the real laws of football — a red card is not a substitution opportunity).
- **Basketball has no discipline mechanic** — `_apply_discipline` returns
  immediately for any non-football sport (no foul-out modeling, no technical fouls).

## Explicitly NOT implemented (verified by direct inspection, not assumed)

- **Injuries.** The word "injury" appears **only** as descriptive commentary inside
  the substitution-timing comment ("a small 1st-half share are injury/tactical
  emergency substitutions") — there is no injury *event type*, no injury
  probability, and no mechanism that forces an unplanned substitution based on an
  in-match injury. A player coming off early is simply one of the pre-drawn
  first-half substitution slots; nothing in the code distinguishes "injured" from
  "tactically withdrawn."
- **Penalties (kicks or shootouts).** A repository-wide, case-insensitive search for
  `"penalty"` across `simulation.py` and `scoring_rules.py` returns **no matches**.
  The Sporty backend's `FootballStat` table does have `penalties_saved`/
  `penalties_missed` columns (see [07 — Database](07_DATABASE.md)), but the feeder —
  the system's current, active data source — never generates a penalty event, so
  those columns are always `0`/unpopulated from simulated matches. They would only
  ever be populated by the backend's currently-disabled real-API sync path, if and
  when it reports a penalty. There is no penalty-shootout mechanic for drawn
  knockout matches either (not applicable to fantasy league play anyway, since
  Sporty models league fixtures, not knockout ties).
- **Extra time / stoppage time (football).** Football always runs exactly
  `TOTAL_MINUTES[FOOTBALL] = 90` simulated minutes — there is no added-time
  modeling and no extra-time period for football (extra time/penalty shootouts are
  a knockout-competition concept; Sporty's football fixtures are treated as league
  matches that can end in a draw).
- **Possession-based modeling.** The simulation has no concept of "which team has
  the ball right now," passing sequences, or field position — it is a **pure
  event-rate model**: every player-event-type combination is an independent
  per-minute probability, not the output of an underlying possession/phase-of-play
  simulation. "Possession logic" in the sense the general documentation template
  asks about **does not exist in this codebase**.

## Basketball overtime (the one "extra time" mechanic that does exist)

Basketball has no draws in reality, so a regulation-time tie (`home_score ==
away_score` after minute 48) triggers a **10-minute overtime period**
(`OVERTIME_MINUTES`), which runs through the exact same `play_minute` per-minute
loop (substitution/rotation, sampling, discipline-skip, scoring, push) as regulation
time. If still tied after one period, another begins, up to
**`MAX_OVERTIME_PERIODS = 6`** as a hard safety cap (preventing a pathological
infinite loop in the vanishingly unlikely event of six consecutive tied periods).

## Finishing a match

When the minute loop (plus any overtime) completes, or a stop was requested and
honored:
1. `state.status` is set to `"stopped"` (if a stop was requested) or `"finished"`;
   `Match.status = "finished"` is committed.
2. **Ratings** (`rater.rate_players`, see [04 — Models](04_MODELS.md) Model 6) are
   computed from the accumulated `events_by_player` map, and **man-of-the-match**
   (`find_man_of_match`) is derived (highest rating, ties broken to the lowest
   player id — deterministic). Ratings are stored in the feeder's own
   `player_match_ratings` table (existing rows for the match are deleted first, so
   this is idempotent per match).
3. **Final pushes** (if the match has a resolved backend link): a final
   `match-result` push with `status: "finished"` and an empty event list (so the
   backend's finish-transition logic — `persist_match_stats` +
   `enqueue_scoring_for_finished_match`, see [03 — Request Flow](03_REQUEST_FLOW.md)
   — fires even if the very last simulated minute happened to have zero events);
   then a `player-ratings` push carrying each player's rating, goals/assists tallies
   (derived by counting event types), and **actual** minutes played (falling back to
   the full match clock only for legacy pre-substitution-tracking replays).
4. **Model-metrics refresh** (best-effort, wrapped in its own broad
   `try/except Exception` so a failure here **never** affects the simulation's own
   success/failure state): calls
   `app.services.prediction_metrics.build_metrics_push_payload` and pushes it via
   `push_model_metrics` — this is what feeds the Sporty backend's
   `GET /api/model-metrics` scorecard endpoint (see [04 — Models](04_MODELS.md)),
   refreshed opportunistically whenever a match finishes since a newly-finished
   match may settle a previously-stored prediction's accuracy.

## Error handling

The entire `run_simulation` body is wrapped in one `try/except Exception`. On any
unhandled exception: `state.status = "error"`, `state.error = str(exc)`, the
exception is logged with a full traceback (`logger.exception`, noting "partial
events retained locally" — nothing already-written is rolled back from the events
table, only the current DB transaction is rolled back), and a best-effort attempt is
made to mark the `Match` row itself as `status = "error"` in a **fresh** transaction
(since the original one may be unusable after the rollback). The `finally` block
always closes the DB session. This is the concrete mechanism behind the module's own
stated design goal: **the simulation loop must never crash the process it runs in.**

## Recovery: replaying a match's events

`POST /matches/{id}/replay-push` (`app/routers/simulation.py:replay_push`) exists
for the case where a match's events were generated but never successfully reached
the Sporty backend (e.g. the backend was down, or the match had no entity link at
the time). It re-derives the match's current score by replaying stored events
through `scoring_rules.score_events` (never trusting a possibly-stale cached score),
backfills `event_id` on any legacy rows that predate idempotency-key tracking, and
re-sends the **entire** event history as one `match-result` payload. Because the
Sporty backend's ingestion is idempotent on `(match_id, event_id)` (see
[06 — Algorithms](06_ALGORITHMS.md) §6a), a replay of already-delivered events is
safe — it will not double-count anything that already landed.

## Pseudocode summary

```
function run_simulation(match_id):
    setup = prepare(match_id)              # lineups, rates, calibration, id links
    dynamics = init_dynamics(setup)         # bench, sub timings, card memory
    mark match LIVE; push "live" kickoff (0 events)

    for minute in 1..total_minutes:
        if stop_requested: break
        sub_events = run_substitutions_or_rotation(setup, dynamics, minute)
        scored_events = sample_bernoulli_events(setup, minute)   # + coupled assists
        minute_events = sub_events + scored_events
        apply_discipline(setup, dynamics, minute_events)          # 2nd yellow -> red -> off
        advance_clocks(setup, dynamics)
        persist(minute_events); update running score
        if minute_events and push_enabled: push_match_result(minute_events)
        sleep(SIMULATION_SPEED)

    if basketball and tied and not stop_requested:
        repeat 10-minute overtime periods (up to 6) using the same per-minute loop

    mark match FINISHED
    ratings = rate_players(events_by_player)
    man_of_match = highest rating, ties -> lowest id
    push final "finished" result, push ratings, best-effort push model metrics
```

## Explain Like I'm New

Imagine a very detailed dice-rolling game: every minute, for every player on the
field, the game rolls a weighted die to decide "did this player score a goal this
minute? Get a yellow card? Get subbed off?" — weighted so that a striker's "score a
goal" die is much more likely to land on yes than a goalkeeper's. Assists aren't
their own die roll — they only happen right after a goal die comes up "yes," when a
second die picks which teammate gets the assist. Substitutions in football are drawn
in advance for realistic-feeling timing (a few early, a burst at half-time, most in
the last third), and once a player is subbed off in football, they're done for the
match — but in basketball, players rotate on and off the bench all game long, just
like a real NBA rotation. There's no "save file" for a specific random outcome
though — run the same match twice and you'll get two different games, on purpose,
so simulations feel fresh rather than scripted.

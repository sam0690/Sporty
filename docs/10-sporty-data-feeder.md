# 10 — Sporty Data Feeder (the match simulator)

The **SportyDataFeeder** (sibling repo `~/projects/SportyDataFeeder`) is the piece that stands in
for a real, paid live-sports data feed. It is a **FastAPI + scikit-learn/SciPy match simulator**
that: imports real historical stats, trains ML models from them, plays out matches minute-by-minute
by sampling player events from those models, and **pushes** the resulting events/scores/ratings to
the Sporty backend's `/api/v1/feed/*` endpoints. From the backend's point of view, a simulated match
is indistinguishable from a real one.

This chapter explains the feeder's data model, its ML models, the simulation algorithm (with all
the non-trivial statistics), and the push/orchestration layer that ties it to Sporty.

## What problem it solves

Sporty needs realistic per-player match performance to have anything to score. Real feeds cost
money and have quotas. The feeder generates statistically-plausible matches — realistic scorelines,
home advantage, assist patterns, player form — so the whole Sporty product (drafting, transfers,
live scoring, leaderboards) can be demonstrated end-to-end without a paid feed. The backend's
real-API pollers ([08](08-live-match-pipeline.md)) are the eventual drop-in replacement; the feeder
writes into the exact same model shape so flipping the source changes nothing downstream.

## Architecture (`SportyDataFeeder/app/`)

Standard FastAPI layering: `main.py` registers routers → `routers/` handle HTTP → `services/` hold
logic → `database.py` defines the ORM + session.

- **`main.py`** — entry point. A lifespan hook loads the pkl models into `app.state`
  (`outcome_model`, `event_rates`, `outcome_v2`, `outcome_v2_basketball`); missing pkls only WARN
  (the app still boots and falls back to heuristics). An **HTTP middleware** requires the
  `X-Feeder-Secret` header on every route except `/health`, `/docs`, `/openapi.json`, `/admin`.
  `/health` reports DB status, running simulation count, and which models are loaded.
- **`config.py`** — a single cached `Settings` (`DATABASE_URL`, `SPORTY_BACKEND_URL`,
  `FEEDER_SECRET`, `SIMULATION_SPEED`, `SIMULATION_CALIBRATE`). All config goes through here.
- **`database.py`** — SQLAlchemy 2.0 models + engine + `scoped_session`/`SessionFactory`. Schema
  is Alembic-managed (the app does **not** `create_all`).

### The feeder's data model (`database.py`)

Its own DB, **separate** from Sporty's, with integer PKs:

| Table | Purpose |
|-------|---------|
| `sports` | football / basketball |
| `teams` | clubs (name, sport) |
| `players` | roster (name, team, position, sport) |
| `matches` | fixtures (home/away team, date, status) — **scores are NOT stored** |
| `events` | per-minute simulated events; unique `event_id` (UUID) is the **idempotency key** |
| `player_stats` | imported historical stats (football goals/assists/cards/points; basketball pts/ast/reb/…); unique `(player_id, gameweek, season)` |
| `entity_links` | maps feeder int ids ↔ Sporty UUIDs (`feeder_entity`, `feeder_id`, `sporty_uuid`) |
| `match_predictions` | outcome probabilities |
| `player_match_ratings` | post-match ratings + man-of-match flag |

Two design points echoed from `CLAUDE.md`:
- **Scores are never stored — they are derived by replaying events** through
  `scoring_rules.score_events`. Football counts `goal` events; basketball sums point values.
- **`Event.extra` is a TEXT column holding JSON** (`json.dumps`/`json.loads`), not JSONB.

## The ML layer

### Feature computation (`services/features.py`)

`compute_player_features(player_id, db)` turns a player's `player_stats` rows into **per-minute
event rates** plus a **form index**, and never raises — a player with no stats gets league-average
**cold-start fallbacks** (`FOOTBALL_FALLBACK_RATES`, `BASKETBALL_FALLBACK_RATES`). Key ideas:
- **Per-minute event rates**: e.g. football `goal_rate = total_goals / total_minutes`. Basketball
  `player_stats` only stores total points, so points are decomposed into 2pt/3pt/FT rates using a
  fixed NBA scoring mix (`BASKETBALL_POINT_MIX = {point_2:0.60, point_3:0.25, free_throw:0.15}`) and
  their point values.
- **Form index**: an **EWMA** (exponentially weighted moving average, α=0.4) over recent per-match
  ratings/points, newest first — recent form counts more. Cold start = `NEUTRAL_FORM_INDEX` 7.5.
- **`compute_team_strength(team_id)`**: mean player form_index normalized /15, clamped to [0,1]
  (0.5 for an empty team). Feeds the outcome heuristic.

Everything downstream (training, simulation, prediction) reads features through this module — never
raw stat rows.

### Model files (`services/ml_models.py`)

Models are pickled into `models_pkl/` (gitignored — they're environment-specific because
`event_rates` is keyed by *this* DB's player ids). Loaders return `None` + WARNING on missing files
so nothing is ever fatal.
- **`event_rates.pkl`** — `{player_id: {event_type: per-minute probability}}` for every player with
  stats. This drives the simulation.
- **`outcome_model.pkl`** — a scikit-learn `Pipeline(MinMaxScaler, LogisticRegression)` predicting
  the 3-class match outcome (0=away, 1=draw, 2=home) from `[home_strength, away_strength, 1.0]`. The
  scaler is serialized **inside** the pipeline (never a separate scaler.pkl). `predict_outcome`
  always maps probabilities through `model.classes_` (never assumes class order).
- **`outcome_v2.pkl` / `outcome_v2_basketball.pkl`** — the **real-data Elo** bundles (see below),
  used by `/predict` and the demo launcher for higher-quality pre-match probabilities.

### Two outcome-model generations

- **v1 (logistic on team strength)** — trained by `scripts/train_models.py` on finished *simulated*
  matches: features are the two teams' strengths, labels are the replayed outcome. `<5` matches
  skips; `≥20` does a stratified 80/20 split with a classification report.
- **v2 (Elo + logistic)** — trained offline on **real historical results** (`scripts/finalize_outcome_v2.py`).
  Each team gets an Elo rating; `predict_outcome_v2(bundle, home, away)` computes
  `elo_diff = (rating_home + home_advantage) − rating_away`, feeds it to a 1-feature logistic
  `Pipeline`, and returns H/D/A probabilities plus a sigmoid-derived per-team strength. Team names
  are normalized through an alias map. Football is 3-class; basketball is 2-class (no draw).
- **Dixon-Coles (football, Phase C)** — `services/dixon_coles.py` implements the classic
  **bivariate-Poisson goal model**: each team has attack + defence parameters, goals are Poisson
  with `log(λ_home) = home_adv + attack[home] + defence[away]`, plus the **Dixon-Coles low-score
  correction** `τ` that fixes the well-known under-count of 0-0/1-0/0-1/1-1 scorelines. Fitting uses
  exponential time-decay weighting (recent matches matter more) + light L2, and is **causal** (only
  matches strictly before the target). Outcome probabilities come from summing the score-line
  probability matrix (truncated at 10 goals). This is a research-grade alternative outcome model.

## The simulation algorithm (`services/simulation.py`)

This is the core. `POST /simulate` returns 202 and schedules an **asyncio background task**
(`run_simulation`) that plays the match minute-by-minute. State per match lives in a registry
(`_simulations: dict[match_id, SimulationState]`) so concurrent simulations of different matches are
independent (one running sim per match; duplicate → 409).

### Setup (`_prepare`)

1. **Lineups**: pick the on-court players — 11 for football, **5** for basketball (not the 10-man
   roster; running 10 for 48 minutes doubled real on-court minutes and inflated every stat).
   `_select_lineup` pulls **featured** players first (a demo affordance to guarantee a specific
   drafted player plays), then fills by lowest id.
2. **Per-player rates**: look each lineup player up in `event_rates`; cold-start players get the
   league-average fallback.
3. **Calibration** (`calibrate_scoring_rates`, if `SIMULATION_CALIBRATE`): scale **only the scoring-
   event rates** so each side's *expected* score matches its real **home/away league average**
   (football 1.55 home / 1.25 away goals; basketball 104.9 / 102.2 points). Home and away are scaled
   **independently**, which bakes in **home advantage** — so simulated home-win rates approach reality
   (EPL ~45% home, NBA ~58% home). The scale factor is uniform within a side, so each player keeps
   their share of the scoring; only the overall level changes. Non-scoring events (cards, rebounds)
   are untouched.
4. **Featured floor** (applied last, after calibration): a featured player's primary scoring event
   gets a per-minute probability **floor** (football goal 0.03 → ≈2.7 expected goals over a match) so
   a demoed player reliably registers a stat instead of the dice skipping them.
5. **ID mappings**: load `entity_links` to translate feeder ids → Sporty UUIDs for the push.

### The per-minute loop (`_sample_minute_events`, `play_minute`)

For each of the ~90/48 minutes:
1. For each active player and each of their event types, **Bernoulli-sample** (fire the event with
   probability = that player's per-minute rate). Independent draws per player per event per minute.
2. **Assists are special** — they are never sampled standalone (a real assist only exists because a
   teammate scored). When a scoring event fires (`goal`, or `point_2`/`point_3` — free throws are
   never assisted), a teammate is credited an assist with `ASSIST_PROBABILITY` (football 0.75, NBA
   0.58 — real-data rates). The assister is chosen from teammates, **weighted by their own assist
   rate** (`_pick_assister`), so playmakers assist more. Not every goal is assisted (solo efforts).
3. Each fired event gets a **UUID `event_id`** (the idempotency key), is written to `events`, and its
   score value (`event_score_value` from the shared `scoring_rules`) is added to the correct team's
   running score.
4. **One HTTP push per minute** — the whole minute's event batch goes to the backend in a single
   `push_match_result` call (never per-event). Then `await asyncio.sleep(SIMULATION_SPEED)` (0 = max
   speed; a real-time demo sets it higher).

### Finishing

- **Basketball has no draws**: a regulation tie triggers 10-minute **overtime** periods (capped at 6)
  until it's broken.
- On finish: set `match.status = finished`, compute **player ratings** (`rater.py`: base 6.0 +
  per-event weights, clamped 1–10) and **man-of-match** (highest rating, ties → lowest id), store
  them, and push a final `match-result` (status=finished, empty events) plus a `player-ratings`
  payload.
- The loop **never raises**: failures mark the state as `error` and are logged; push failures are
  tolerated (events persist locally and can be re-pushed via `/matches/{id}/replay-push`).

### Scoring truth (`services/scoring_rules.py`)

`event_score_value(event_type, extra, sport_type)` and `score_events(...)` are the **single source**
of how events become match scores, imported by both the simulation and the match-read replay. Football:
a `goal` = 1. Basketball: `point_2`=2, `point_3`=3, `free_throw`=1 (from `extra.points`, falling back
to canonical values). This is the feeder's *match score* — distinct from Sporty's *fantasy* points.

## The push layer (`services/backend_client.py`)

`BackendClient` posts to `{SPORTY_BACKEND_URL}/api/v1/feed/*` with the `X-Feeder-Secret` header, **3
attempts with exponential backoff** (1.5ⁿ). A failed push logs ERROR and returns `False` — the
simulation continues (events persist locally; replay recovers). It wraps every feed endpoint:
`schedule_match`, `register_players`, `resolve_players`, `demo_setup` (these use a single-attempt
`_post_json` because the caller needs the response body), and `push_match_result` / `push_prediction`
/ `push_player_ratings` / `push_lineups` (the retrying `_post`).

## The one-call demo orchestrator (`routers/demo.py`)

`POST /demo/launch` is the glue that turns a feeder match into a fully-wired Sporty live match. Given
a feeder `match_id` it:
1. **Schedules** the fixture on the backend (`/feed/schedule-match`) and **links** it
   (`entity_links`).
2. **Maps the lineup to backend players** — either `register-players` (create feeder-owned players,
   throwaway demos) or `resolve_existing` (map onto players real users already drafted, by name) —
   and links each so pushed events carry a real `sporty_player_id`.
3. **Pushes the starting lineups** (`/feed/match-lineups`) so the match page shows who's playing.
4. **Pushes the outcome prediction** (`predict_outcome_v2`) so the frontend prediction card populates.
5. Optionally **sets up a throwaway demo fantasy lineup** (`/feed/demo-setup`) so a demo user's total
   scores.
6. **Starts the simulation** now (`simulate=true`) or leaves it for a later `POST /simulate` (prepare
   mode — gives real users time to draft the registered players first).

It returns everything a demo needs: the `sporty_match_id`, the draftable players, the prediction, and
the `frontend_url` (`/match/{sporty_match_id}`). There's also a static `/admin` control panel
(`app/static/admin.html`) for driving all this from a UI (the panel's JS supplies the secret per call).

## How the feeder connects to the whole system

```
 historical CSVs ──importer──▶ player_stats ──features──▶ event_rates.pkl / outcome models
                                                                │
 POST /demo/launch (or /simulate) ──────────────────────────────┤
   1. schedule-match  ─▶ backend creates a Match                 │
   2. register/resolve-players ─▶ backend Player rows + links    │
   3. simulation loop ── every minute ──▶ POST /feed/match-result│  (uses event_rates + calibration)
                                              │                   │
                                              ▼                   │
                        backend: upsert live_events, update Match,│
                        publish SCORE_UPDATE + FANTASY_POINTS_DELTA to Redis,
                        (on finish) persist stats + enqueue scoring
                                              │
                                              ▼
                        Redis pub/sub ─▶ WebSocket ─▶ frontend live match page
                        scoring job ─▶ TeamWeeklyScore + rankings ─▶ leaderboard
```

The feeder ends where [08 — Live Match Pipeline](08-live-match-pipeline.md) begins. The full trace of
a simulated match becoming leaderboard points is in [11 — End-to-End Flows](11-end-to-end-flows.md).

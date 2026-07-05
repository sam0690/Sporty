# 04 — Statistical & Machine Learning Models

## Where the models live, and where they don't

**`Sporty_Backend` has no statistical or machine-learning models.** Its
"intelligent" behavior — squad auto-pick, lineup optimization — is **integer linear
programming** (a deterministic combinatorial optimizer, not a model fit to data); see
[06 — Algorithms](06_ALGORITHMS.md) §1. Nothing in the backend is trained, has
weights, or produces a probabilistic prediction.

All statistical/ML modeling lives in the sibling repository **`SportyDataFeeder`**,
whose job is to generate realistic simulated matches and pre-match predictions. Five
models/techniques are covered below, each with its own subsection per the required
template. A sixth item (**EWMA form index**) is a feature-engineering technique, not
a standalone predictive model, but is documented with the same rigor since every
other model consumes its output.

**Abbreviations used in this chapter** (see also [13 — Glossary](13_GLOSSARY.md)):
ML = Machine Learning, EWMA = Exponentially Weighted Moving Average, Elo = the Elo
rating system (not an acronym — named after its creator, Arpad Elo), MOV = Margin Of
Victory, SoT = Shots on Target, OOS = Out Of Sample, L2 = the L2-norm regularization
penalty (also called ridge/Tikhonov regularization).

---

## Model 1 — EWMA Form Index (feature engineering, not a predictive model)

- **Location:** `SportyDataFeeder/app/services/features.py:_ewma`,
  `compute_player_features`.
- **Purpose:** compress a player's recent match history into one "current form"
  number, feeding team strength (Model 2) and the v1 outcome model (Model 3).
- **Why EWMA (Exponentially Weighted Moving Average) over a plain average:** a plain
  average treats a match from six weeks ago identically to last week's — it doesn't
  track hot/cold streaks. EWMA weights recent observations exponentially more.
- **Alternatives considered:** none evidenced in code/comments; a simple moving
  average or a Kalman filter would be the natural alternatives, but there is no
  record of them being tried.
- **Math:** for values ordered newest-first, with decay `α = 0.4`
  (`EWMA_ALPHA`):
  `form = (Σᵢ wᵢ·valueᵢ) / (Σᵢ wᵢ)`, `wᵢ = α(1−α)ⁱ` (i=0 is the newest match). This is
  implemented as a running sum (`_ewma`), not a closed-form formula, so it works for
  any input length.
- **Input:** for football, each of the last up to `MAX_FORM_ROWS = 20` `PlayerStat`
  rows' `points` (per-match rating/points), newest first, ordered by
  `(season DESC, gameweek DESC)`. For basketball, points-per-36-minutes (a
  minutes-normalized scoring rate) per row, since raw box-score totals aren't
  directly comparable to football per-match points.
- **Output:** one float, `form_index`, nominally on a football-points-like scale;
  cold-start (no stats, or `MIN_FORM_ROWS`-worth of data absent — note: the constant
  `MIN_FORM_ROWS = 5` is defined but the actual cold-start trigger implemented is
  "zero stat rows or zero total minutes," not a 5-row minimum — see
  [14 — Improvements](14_IMPROVEMENTS.md)) players get a neutral `NEUTRAL_FORM_INDEX
  = 7.5`.
- **"Training":** none — this is a deterministic transform, computed fresh on every
  call to `compute_player_features`, not fit to data or persisted as a model
  artifact.
- **Validation/evaluation:** none — it's a feature, not a model with its own
  accuracy metric; its quality is only visible indirectly through the outcome
  models that consume it.
- **Assumptions:** recent performance is a better predictor of near-future
  performance than long-run average; `α = 0.4` (a fairly aggressive recency weight)
  is a hand-chosen constant, not tuned via cross-validation.
- **Strengths:** trivially cheap (O(rows)), no training pipeline, naturally adapts
  to injuries/loss of form without a model-refresh cycle.
- **Weaknesses/limitations:** the `α` and `MAX_FORM_ROWS` constants are hand-picked,
  not validated; no adjustment for strength of opponent faced in those recent
  matches; cold-start fallback is a single global constant per sport, not
  position-aware (a cold-start goalkeeper and a cold-start striker get the same
  neutral form).
- **Interaction with the rest of the system:** feeds `compute_team_strength` (Model
  2) and, indirectly, `predict_outcome` (Model 3, v1). It does **not** feed the v2/
  v4/v5 Elo-based production outcome models — those use team-level Elo ratings
  instead of player-level form (see Model 4).

## Model 2 — Team Strength Score (heuristic aggregate, not a trained model)

- **Location:** `features.py:compute_team_strength`.
- **Purpose:** collapse a roster of player form indices into one 0–1 "how good is
  this team right now" number for the v1 outcome model's feature vector.
- **Math:** `strength = clamp(mean(form_index for each player on the roster) / 15,
  0, 1)`; `0.5` for an empty roster. The `/15` constant maps the football
  points-like form scale onto roughly `[0,1]`.
- **Input:** every `Player` row for a `team_id` (no filtering by position or
  recent-appearance — every rostered player counts equally, whether or not they've
  played recently).
- **Output:** one float in `[0, 1]`.
- **Weaknesses:** simple mean, not minutes-weighted — a large squad with many
  unused fringe players at neutral form (7.5/15 ≈ 0.5) will regress toward 0.5
  regardless of how strong the starting XI actually is. This is a real, identifiable
  limitation of the v1 pipeline that the later Elo-based models (which rate the
  *team*, not an average of individually-rated players) sidestep entirely.

## Model 3 — Logistic Regression Outcome Model, v1 ("outcome_v1_logistic")

- **Model name / file:** `outcome_model.pkl`, trained by
  `SportyDataFeeder/scripts/train_models.py`, loaded/served by
  `app/services/ml_models.py:predict_outcome`.
- **Full form of abbreviation:** Logistic Regression — a linear classifier that
  models the log-odds of each class as a linear function of the input features,
  producing calibrated-shape class probabilities via the softmax/sigmoid link.
- **Purpose:** given the two teams' pre-match strength scores, predict a 3-class
  match outcome (home win / draw / away win) for **simulated** matches (this is the
  *original*, earliest model in the codebase, superseded in production accuracy by
  the v2/v4 Elo models below, but still the fallback when no Elo bundle is loaded).
- **Why this model was selected:** with only 2–3 engineered features and a modest
  amount of training data (finished simulated matches), a simple, well-calibrated,
  low-variance linear classifier is the appropriate first model — it won't overfit,
  it's fast to train/serve, and its coefficients are interpretable.
- **Alternative models considered:** none implemented as alternatives to this
  specific model in the codebase at the time it was built; the project later
  explored Elo-based and Dixon-Coles alternatives (Models 4 and 5) as *separate,
  more sophisticated* efforts once real historical data was available, effectively
  superseding rather than being selected against v1 in a head-to-head test.
- **Mathematical intuition:** logistic regression fits a linear boundary in feature
  space and squashes it through a softmax (multinomial case) to get class
  probabilities; here there are only 3 numbers going in, so the model is really just
  learning "how much does the home-vs-away strength gap move the odds of each
  outcome," plus a bias/intercept term.
- **Input features:** `[home_strength, away_strength, 1.0]` (the trailing `1.0` is a
  bias-like constant feature — with an intercept-fitting `LogisticRegression` this is
  partially redundant with the model's own intercept term; **could not determine**
  from the code why both are present).
- **Output:** `{home_win_prob, draw_prob, away_win_prob, model_version:
  "outcome_v1_logistic"}`. Probabilities are mapped through `model.classes_`
  (`predict_outcome` never assumes label order — a defensive habit worth noting as
  good practice).
- **Training process:** `scripts/train_models.py` pulls every finished match from the
  feeder's own database, computes each match's two teams' strengths at that point,
  and labels the row with the actual simulated result (`_score_match`). Labels: `0 =
  away win, 1 = draw, 2 = home win` (`LABEL_AWAY/DRAW/HOME` in `ml_models.py`). The
  pipeline is `Pipeline(MinMaxScaler, LogisticRegression)` — the scaler is fit and
  serialized **inside** the pipeline object (never saved separately), so inference
  always applies the exact scaling the model was trained with.
- **Validation process:** if there are **fewer than 5** finished matches, training is
  skipped entirely (not enough data to fit anything meaningful). If there are **20 or
  more**, the script does a **stratified 80/20 train/test split**
  (`sklearn.model_selection.train_test_split`, stratified so all three classes are
  represented proportionally in both splits) and prints a
  `sklearn.metrics.classification_report` (precision/recall/F1 per class) — this is
  a held-out validation, not k-fold cross-validation.
- **Evaluation metrics:** **Precision**, **Recall**, and **F1-score** per class (via
  `classification_report`); no log loss or calibration curve is computed for this
  particular model (contrast with the v2+ pipeline below, which is evaluated on log
  loss).
- **Hyperparameters:** scikit-learn defaults for `LogisticRegression` (multinomial,
  L2 penalty, `lbfgs` solver — **could not determine** an explicit
  `class_weight`/`max_iter`/`C` override in the training script; if not shown, the
  library defaults apply) and `MinMaxScaler` (default `[0,1]` feature range).
- **Feature engineering:** the two team-strength scalars (Model 2) plus a constant.
  No opponent-adjusted, home/away-split, or time-decayed features at this stage —
  those refinements arrive in the v2+ line.
- **Data preprocessing:** `MinMaxScaler` on the two strength features (already
  roughly `[0,1]` from Model 2's own clamping, so the scaler's effect here is mild).
- **Assumptions:** that a team's *current* mean player form is sufficient signal for
  match outcome, independent of home/away, opponent history, or schedule context.
- **Weaknesses:** only trained on the feeder's **own simulated** match history — a
  form of circularity (the model is trained on outcomes generated by the same
  simulation whose realism it's meant to help calibrate — though note the *model*
  doesn't feed back into `calibrate_scoring_rates`, only into the pre-match
  prediction display, so the circularity is contained). Two features is a thin
  feature set. No opponent-specific or home-advantage term (home advantage is
  encoded only implicitly if home strength happens to correlate with it, which it
  doesn't by construction).
- **Strengths:** simple, fast, robust to little data, interpretable, and a
  well-behaved fallback: `predict_outcome` explicitly falls back to a hand-written
  heuristic (`heuristic_outcome` — a strength-difference formula, see the code in
  `ml_models.py`) whenever no `.pkl` model is loaded at all, so the system degrades
  gracefully rather than erroring.
- **Limitations:** superseded in production football/basketball prediction quality
  by the Elo-based v2/v4 bundles (Model 4), which are trained on **real** historical
  results rather than simulated ones.
- **Complexity:** O(1) inference (a 3-feature linear model); training is O(n) in
  finished-match count for feature computation, dominated by scikit-learn's
  logistic-regression fit cost (fast at this data scale).
- **Interaction with the rest of the system:** consumed by the feeder's `/predict`
  endpoint as the fallback path when the Elo bundle (Model 4) can't resolve a team
  name or the file is missing.
- **Files:** training — `scripts/train_models.py`. Inference — `ml_models.py:
  predict_outcome`. Loading — `ml_models.py:load_model`/`load_all_models`
  (returns `None` + a logged warning on a missing file; never fatal). Evaluation —
  inline in `train_models.py` (printed `classification_report`, not persisted to a
  report file).
- **Exact execution flow:** app boot (`main.py` lifespan) → `load_all_models()` →
  `app.state.outcome_model` → a request to a prediction-serving route → `
  predict_outcome(app.state.outcome_model, home_strength, away_strength)` →
  JSON response.

## Model 4 — Elo Rating + Logistic Regression Outcome Model, v2/v4/v5 ("outcome_v2_elo" / "outcome_v4_elo_sot")

This is the **current production** pre-match prediction model for both football and
basketball (`predict_outcome_v2`), the result of an iterative, walk-forward-validated
research process (`reports/OUTCOME_MODEL_TRAINING_PLAN.md`,
`MODEL_IMPROVEMENT_PLAN.md` — **the reports themselves were not read for this
chapter; their existence and step numbering is taken from the training scripts'
header comments**, so their narrative claims should be treated as the feeder repo's
own account of its process, not independently re-verified here).

- **Model name:** Elo (a relative-skill rating system, not an acronym — named for
  its creator Arpad Elo, originally for chess) feeding a **binary/multinomial
  Logistic Regression** classifier. Production football version is internally
  labeled `outcome_v4_elo_sot` (Margin-of-Victory Elo + Shots-on-Target form);
  production basketball version is `outcome_v2_elo` (Elo + rest-adjusted
  hyperparameters, 2-class).
- **Purpose:** predict pre-match win/draw/loss (football, 3-class) or win/loss
  (basketball, 2-class — no draws) probabilities from **real historical results**,
  used both for the feeder's `/predict` endpoint (surfaced to the Sporty frontend's
  `PredictionCard`) and for the demo launcher's prediction push.
- **Why Elo + logistic (over a purely data-driven model per match):** Elo is the
  proven rating system for exactly this kind of pairwise-competition problem (chess,
  and widely adapted to team sports); it compresses an entire season's results into
  one slowly-updating number per team, which is both statistically efficient (little
  data needed per update) and interpretable. Feeding the Elo **difference** (plus,
  in the football v4 bundle, a shots-on-target form term) into a small logistic
  regression converts a rating gap into calibrated win/draw/loss probabilities — a
  standard, well-understood combination in sports analytics.
- **Alternatives considered (and empirically compared, not just discussed):** the
  training scripts explicitly benchmark several concrete alternatives on the same
  **walk-forward, leakage-free evaluation harness**
  (`scripts/backtest_outcome.py`/`backtest_basketball.py`):
  - `logistic_form` — multinomial logistic on Elo diff + causal rolling team-level
    form (a Model 3-like feature added on top of Elo).
  - `dixon_coles` — the bivariate-Poisson goal model (Model 5, below) — a genuinely
    different model class, not just a hyperparameter variant.
  - `elo_absdiff` — Elo diff plus `|Elo diff|` (a draw-probability feature).
  - `blend_ed`/`blend_edf` — causal stacked ensembles combining Elo, Dixon-Coles,
    and/or the form model, with blend weights fit only on **prior** folds' held-out
    predictions (no leakage).
  - `elo_mov`/`elo_shots_net`/`elo_shots_full`/`elo_mov_shots` — Elo with a
    margin-of-victory update rule, with/without shots-on-target features.
  - A **bookmaker ceiling** — de-margined (vig-removed) closing odds from a real
    bookmaker (Bet365), used as an upper bound on achievable accuracy for this
    market, not a deployable model.
  The production choice (documented in `finalize_outcome_v2.py`'s header) is the
  **margin-of-victory Elo + shots-on-target-form** variant, which beat the plain
  Elo config in pooled out-of-sample log loss (**0.9661 vs 0.9709**) while the
  bookmaker ceiling was **0.9527** — i.e. the model gets meaningfully closer to, but
  does not beat, real bookmaker pricing, which is the expected and honestly reported
  outcome for a model of this scope.
- **Mathematical intuition:** Elo assumes each team has a latent skill rating; the
  probability the home team wins a single match is a logistic function of the rating
  gap (plus a home-advantage bonus): a bigger gap → a more lopsided expected result.
  After each match, both teams' ratings move toward the result actually observed,
  scaled by how *surprising* that result was (a team that was heavily favored and
  won barely moves; a big upset moves ratings a lot). Feeding the resulting `Elo
  diff` into a logistic regression (rather than using Elo's own raw win-probability
  formula directly) lets the model *learn* the right mapping from rating gap to
  probabilities from real data, including a genuine draw class for football.
- **Input features:** production football bundle: `['elo_diff', 'sot_net_diff']`
  (Elo rating gap including home advantage, and each team's rolling net
  shots-on-target form differential). Production basketball bundle: `['elo_diff']`
  only (2-class, no draw; rest/back-to-back schedule features were shown to help in
  backtesting but were **excluded from production** because they need a live
  schedule feed at prediction time that isn't wired up — an honestly documented
  scope cut, see `finalize_outcome_basketball.py`'s comment).
- **Output:** `{home_win_prob, draw_prob, away_win_prob (0.0 for basketball),
  model_version, elo_diff, home_known, away_known, home_strength, away_strength}`.
  The last two are a cheap sigmoid transform of each team's raw Elo rating
  (`1/(1+e^{-(r-1500)/400})`), included so the response stays populated for UI
  display without an expensive player-level query.
- **The Elo update rule itself** (`app/services/team_ratings.py:EloModel`):
  - `expected_home = 1 / (1 + 10^(-((rating_home + home_advantage) - rating_away) / 400))`
    — the classic Elo expected-score formula.
  - Rating update per match: `new_rating = rating + K · mov_multiplier · (actual −
    expected)`, where `actual` is 1/0.5/0 for a win/draw/loss and `mov_multiplier`
    optionally scales the update by how large the winning margin was:
    - **`"wfe"`** (World Football Elo, football): `1.0` for a margin ≤ 1 goal,
      `1.5` for a 2-goal margin, `(11 + margin) / 8` for 3+ (a standard published
      international-football Elo convention).
    - **`"fte"`** (FiveThirtyEight, basketball): `((margin + 3)^0.8) /
      (7.5 + 0.006 · winner_rating_diff)` — dampened when the pre-match favorite
      wins by a lot, an autocorrelation guard so the model doesn't over-react to
      blowouts by already-strong teams.
  - **Season regression**: at each new season boundary, every team's rating is
    pulled partway back toward the base rating `1500`:
    `rating ← rating + season_regression · (1500 − rating)` — prevents a
    historically dominant team's rating from staying artificially inflated forever,
    and gives promoted/rebuilt teams a fairer starting point.
  - **New/unseen teams** start at the base rating (`1500`), so a promoted club
    enters with a neutral prior rather than an arbitrary guess.
  - This is a **causal, strictly forward-in-time** update: at any point, a team's
    rating reflects only matches that happened *before* that point — no lookahead
    leakage into the walk-forward evaluation.
- **Production hyperparameters (from the `finalize_*` scripts, i.e. the
  currently-deployed configuration, not just a training-script default):**

  | Sport | K | Home advantage | Season regression | MOV rule |
  |---|---|---|---|---|
  | Football (v4) | 40 | (absorbed into the logistic intercept per v3's finding — HA fixed at 65 during grid search) | 0.10 | `"wfe"` |
  | Basketball | 20 | 60.0 | 0.40 | `"fte"` |

- **Training process:** offline, via `scripts/finalize_outcome_v2.py` (football) /
  `finalize_outcome_basketball.py` (basketball) — **not** run at application
  startup or on a schedule; these are one-off scripts a developer runs to produce a
  new `.pkl` bundle, which is then manually placed in `models_pkl/` (a gitignored
  directory — bundles are environment-specific and not checked into version
  control). The final bundle is fit on **all available real historical matches**
  (not held out), since walk-forward validation already happened in the separate
  `train_outcome_v*.py` research scripts before this finalization step — i.e.
  hyperparameter selection and the final production fit are **deliberately
  separated** so the deployed model gets the benefit of every available data point
  without re-contaminating the validation numbers already reported.
- **Validation process:** **expanding-window walk-forward validation**
  (`scripts/backtest_outcome.py`/`backtest_basketball.py`, reused identically across
  the v2 through v5 research scripts specifically so results are comparable) — the
  model is repeatedly refit using only data up to a point in time, then evaluated on
  the immediately following, still-unseen matches, sliding forward through the
  dataset. This is the correct validation strategy for time-ordered sports data
  (a random train/test split would leak future information into the past via shared
  season-level patterns).
- **Evaluation metrics:** **pooled out-of-sample log loss** (a.k.a. cross-entropy —
  the standard proper scoring rule for probabilistic classifiers; lower is better,
  and it specifically penalizes confident-and-wrong predictions harshly) is the
  primary metric throughout the v2–v5 progression, benchmarked against the
  de-margined bookmaker odds as a ceiling.
- **Feature engineering:** Elo ratings (a hand-designed, decades-proven feature
  extractor in its own right) plus, for the football production bundle, a
  **causal rolling shots-on-target net-form** feature (`sot_net_diff` — presumably
  each team's own recent SoT-for minus SoT-against, rolling and causal, though
  **could not fully determine** the exact rolling-window length for this feature
  without reading `scripts/train_outcome_v4.py` in full, which was not done for this
  chapter — flagged here rather than guessed).
- **Data preprocessing:** `StandardScaler` (zero mean, unit variance) inside the
  `sklearn.Pipeline`, serialized with the model — same "never a separate scaler.pkl"
  discipline as Model 3.
- **Assumptions:** that team skill is a slowly-varying latent quantity well
  approximated by a single scalar rating; that a season boundary is a meaningful
  point for partial mean-reversion; that shots-on-target form is a useful leading
  indicator beyond the Elo rating alone (empirically supported by the reported log
  loss improvement).
- **Weaknesses:** basketball's finalized production config explicitly **drops** a
  backtest-proven-useful feature (rest days/back-to-back games) purely because the
  live serving path lacks a schedule feed — a known, documented capability gap, not
  a modeling failure (see [14 — Improvements](14_IMPROVEMENTS.md)). Team-name
  matching depends on a hand-maintained alias map (`APP_TEAM_ALIASES`) between the
  app's team-name strings and the Elo table's canonical names — a new/renamed club
  not in the alias map falls back to the base rating (`home_known`/`away_known: False`
  in the output flags this explicitly).
- **Strengths:** genuinely rigorous, leakage-free, walk-forward-validated,
  explicitly benchmarked against a real bookmaker ceiling rather than an arbitrary
  internal baseline — a notably more disciplined ML process than most of the rest of
  this codebase's data-facing code.
- **Limitations:** trained and finalized **offline**; there is no automatic
  retraining pipeline or drift monitoring evidenced in the repo — the `/model-metrics`
  endpoint the Sporty backend exposes (`GET /api/model-metrics`) reads a
  feeder-pushed scorecard (`model:metrics` in Redis) comparing stored predictions to
  actual results, but **could not determine** any automated trigger that retrains or
  swaps the `.pkl` bundle based on that scorecard — it appears to be a monitoring
  signal for a human to act on, not a closed automated loop.
- **Complexity:** O(1) inference (one Elo lookup per team + a 1–2 feature logistic
  model). Training/backtesting complexity scales with `O(matches × grid-search
  configurations)` for the hyperparameter sweep stages, dominated by the walk-forward
  refitting loop, not by the (trivially cheap) Elo update itself.
- **Interaction with the rest of the system:** `predict_outcome_v2` is called by the
  feeder's `/predict` route and by `routers/demo.py`'s one-call demo launcher (which
  pushes the resulting prediction to the Sporty backend's
  `POST /api/v1/feed/prediction`, cached and later served from
  `GET /api/match/{id}/prediction`). It does **not** feed into the simulation's
  actual event generation (Model-free — see [05 — Simulation Engine](05_SIMULATION_ENGINE.md));
  the simulation's scoreline realism comes from `calibrate_scoring_rates`
  independently, so the pre-match prediction and the simulated result are not
  guaranteed to agree (a prediction favoring the home team does not bias the
  simulation toward a home win beyond the fixed home/away calibration targets).
- **Files:** research/backtesting — `scripts/train_outcome_v2.py` through `v5.py`,
  `scripts/train_basketball_v3.py`, `scripts/backtest_outcome.py`,
  `scripts/backtest_basketball.py`. Finalization (production bundle build) —
  `scripts/finalize_outcome_v2.py`, `scripts/finalize_outcome_basketball.py`.
  Rating engine — `app/services/team_ratings.py`. Inference/loading —
  `app/services/ml_models.py:predict_outcome_v2`, `load_outcome_v2`,
  `load_outcome_v2_basketball`. Evaluation reports — `reports/OUTCOME_MODEL_V3.md`,
  `..._V4.md`, `..._V5.md`, `..._BASKETBALL_V3.md` (referenced by the scripts;
  **not read for this chapter** — their existence is confirmed by the scripts that
  write them, their content was not independently verified).
- **Exact execution flow:** developer runs `finalize_outcome_v2.py` offline → writes
  `models_pkl/outcome_v2.pkl` → app boot loads it into `app.state.outcome_v2` (and
  `outcome_v2_basketball`) → a `/predict` request or the demo launcher calls
  `predict_outcome_v2(bundle, home_team, away_team)` → team names normalized via the
  bundle's alias map → Elo lookup → feature row assembled → `model.predict_proba`
  → response, with a fallback to Model 3 (`predict_outcome`) if the bundle is
  missing or the `kind` field doesn't match `"elo_logistic"`.

## Model 5 — Dixon-Coles Bivariate-Poisson Goal Model (football, research-grade candidate)

- **Location:** `app/services/dixon_coles.py`.
- **Full form / origin:** named for the 1997 paper by Mark Dixon and Stuart Coles,
  "Modelling Association Football Scores and Inefficiencies in the Football Betting
  Market" — a well-known, widely cited football analytics model. "Bivariate Poisson"
  refers to modeling the two teams' goal counts as a *pair* of (adjusted-correlated)
  Poisson-distributed random variables rather than two independent ones.
- **Purpose:** predict the full scoreline probability distribution for a football
  match (not just win/draw/loss), from which win/draw/loss probabilities are derived
  by summing the appropriate cells.
- **Why this model:** goals in football are well-approximated by a Poisson process
  (a fixed, small per-minute scoring chance summed over many minutes), but a
  **plain, independent** Poisson model for each team's goals is empirically known to
  **under-count** certain low, correlated scorelines — specifically 0-0, 1-0, 0-1,
  and 1-1 — because real matches show slight negative correlation between the two
  teams' scoring at very low totals (a cautious/defensive game suppresses both
  sides' scoring together). Dixon-Coles adds a correction term specifically for
  those four cells.
- **Alternatives considered:** evaluated head-to-head against the Elo-based
  candidates (Model 4) and a causal stacked ensemble of both, on the same
  walk-forward harness (`scripts/train_outcome_v2.py`/`v3.py`) — it was **not**
  selected as the production model (Model 4's Elo+SoT variant won on pooled OOS log
  loss), but the implementation remains in the codebase, fully functional, as a
  legitimate alternative/candidate model, not dead code from an abandoned approach.
- **Mathematical intuition:** each team has two latent parameters — **attack**
  strength and **defence** strength (higher attack = scores more; higher defence =
  concedes less). A team's expected goals in a given match come from *its own
  attack* combined with *the opponent's defence* (plus a home-advantage constant for
  the home side). Goals are then Poisson-distributed around that expectation. The
  Dixon-Coles correction `τ` multiplies the four low-score joint probabilities by a
  factor that depends on a single extra parameter `ρ` (rho), nudging them up or down
  to match reality.
- **Formulas:**
  ```
  log(λ_home) = home_adv + attack[home] + defence[away]
  log(μ_away) =           attack[away] + defence[home]
  P(home=x, away=y) = τ(x,y,λ,μ,ρ) · Poisson(x; λ) · Poisson(y; μ)
  ```
  where `τ(0,0) = 1 − λμρ`, `τ(0,1) = 1 + λρ`, `τ(1,0) = 1 + μρ`, `τ(1,1) = 1 − ρ`,
  and `τ = 1` for every other scoreline. Match outcome probabilities: `P(home win) =
  Σ_{x>y} P(x,y)`, `P(draw) = Σ_{x=y} P(x,y)`, `P(away win) = Σ_{x<y} P(x,y)`, summed
  over a score matrix truncated at `MAX_GOALS = 10` goals per side (higher scores are
  probabilistically negligible).
- **Input:** for fitting, a list of historical matches (`home`, `away`, full-time
  home/away goals, `date`). For inference, just the two team names.
- **Output:** `{"H": p, "D": p, "A": p, "lambda_home": λ, "mu_away": μ}` — win/draw/
  loss probabilities plus each side's expected-goals rate.
- **Training process:** maximum-likelihood fitting via `scipy.optimize.minimize`
  (`method="L-BFGS-B"`, a quasi-Newton bounded optimizer), minimizing the **negative
  log-likelihood** of the observed historical scorelines under the model, with two
  additions:
  - **Exponential time-decay weighting**: each match's contribution to the
    likelihood is weighted by `exp(−ξ · age_in_days)`, where
    `ξ = ln(2) / decay_half_life_days` (default half-life **180 days**) — a match
    from a year ago counts for much less than one from last month, without a hard
    cutoff.
  - **Light L2 regularization** (`l2 = 0.01`, default): penalizes the sum of squared
    attack/defence parameters, which stabilizes estimates for newly-promoted or
    low-sample-size teams (whose parameters would otherwise be poorly constrained by
    limited data).
  - **Causal fitting**: the caller (the training scripts) passes only matches
    strictly before the target/evaluation date — no lookahead leakage, matching the
    discipline used everywhere else in this model-selection process.
  - Parameter vector: `[attack(n teams), defence(n teams), home_adv, rho]`, bounded
    (`attack`/`defence` ∈ [−3, 3], `home_adv` ∈ [−1, 1], `rho` ∈ [−0.2, 0.2]) to keep
    the optimizer in a sane region.
- **Validation process:** the same expanding-window walk-forward harness as Model 4
  (`scripts/train_outcome_v2.py`/`v3.py`), reused directly for an apples-to-apples
  comparison.
- **Evaluation metrics:** pooled out-of-sample log loss, same as Model 4 (and the
  bookmaker-ceiling benchmark).
- **Hyperparameters:** `decay_half_life_days = 180.0`, `l2 = 0.01` (both dataclass
  defaults on `DixonColes`; **could not determine** whether these were themselves
  grid-searched or hand-chosen — the training scripts' headers describe grid-search
  for the Elo hyperparameters specifically, not for Dixon-Coles's own decay/L2
  constants).
- **Feature engineering:** none beyond the raw scoreline history — this model is
  "featureless" in the sense that it learns team-level attack/defence parameters
  directly from goals scored/conceded, rather than consuming engineered input
  features like Elo diff or SoT form.
- **Data preprocessing:** none beyond building the team index and the time-decay
  weight vector; no scaling needed since the model parameters are fit via MLE
  directly.
- **Assumptions:** goals are well-modeled by Poisson arrivals; a team's attack/
  defence strength is separable and constant over the fitting window (aside from the
  time-decay softening); the Dixon-Coles correction adequately captures all
  low-score correlation (a simplification — real football has more complex dynamics,
  e.g. game-state effects, which this model does not capture).
- **Strengths:** produces a **full scoreline distribution**, not just 3 outcome
  probabilities — useful for anything needing more than win/draw/loss (e.g. correct
  score markets, expected-goals-style analysis), which the Elo-logistic models
  cannot provide. Well-established, peer-reviewed methodology.
- **Weaknesses:** lost the head-to-head production comparison against the simpler
  Elo+SoT approach on log loss for the specific win/draw/loss prediction task
  Sporty actually needs; more parameters to fit (`2n + 2` for `n` teams) than the
  1–2-feature Elo-logistic models, meaning more data is needed per team for stable
  estimates.
- **Limitations:** football-only — there is no basketball analogue implemented
  (basketball's much higher, less discretely-modelable scoring makes a Poisson goal
  model a poor fit for that sport, which is presumably why no basketball
  Dixon-Coles variant exists — **could not confirm** this reasoning explicitly in
  code comments, it is inferred from domain knowledge and the absence of such a
  module).
- **Complexity:** fitting is `O(iterations × matches × n_teams)` per L-BFGS-B step
  (bounded-memory quasi-Newton, superlinear convergence in well-behaved cases);
  inference is O(`MAX_GOALS²`) = O(121) to build and sum the score matrix — trivial.
- **Interaction with the rest of the system:** **not currently wired into any live
  serving path** — `predict_outcome_v2` only accepts bundles with
  `kind == "elo_logistic"`, so a Dixon-Coles bundle would never be loaded by the
  feeder's `/predict` route as things stand. It exists as a real, tested, available
  alternative model, exercised today only inside the offline research/backtesting
  scripts.
- **Files:** implementation — `app/services/dixon_coles.py`. Used by —
  `scripts/train_outcome_v2.py`, `scripts/train_outcome_v3.py` (both offline
  research scripts, not the production `finalize_*` scripts). No dedicated
  inference/loading module exists for this model, since it isn't served live.

## Model 6 — Rule-Based Post-Match Player Rating (heuristic, not ML)

- **Location:** `app/services/rater.py`.
- **Purpose:** produce a 1–10 post-match rating per player and identify the
  man-of-the-match, without training another model.
- **Why rule-based:** a match's events (goals, assists, cards, rebounds, …) are
  already a strong, interpretable, and instantly-available signal — a full ML rating
  model would need labeled "true rating" training data that doesn't exist for
  simulated matches, so a transparent, tunable weighted-sum heuristic is the
  pragmatic choice.
- **Math:** `rating = clamp(6.0 + Σ weight(event_type) for each event, 1.0, 10.0)`.
  Football weights: goal +2.0, assist +1.2, yellow −0.5, red −2.5. Basketball
  weights: `point_2` +0.8, `point_3` +1.2, `free_throw` +0.3, assist +0.7, rebound
  +0.4, steal +0.6, block +0.5. Event types with no defined weight (e.g. a
  substitution or a turnover) contribute nothing.
- **Input:** the list of event types a player was involved in during the match
  (from the simulation's in-memory `events_by_player` map).
- **Output:** one float per player in `[1.0, 10.0]`; `find_man_of_match` picks the
  highest rating, breaking ties by the **lowest player id** (a deterministic,
  reproducible tiebreak, not a random one).
- **Training/validation/evaluation:** none — this is a fixed heuristic, not fit to
  any data, so there is no training or evaluation process to describe.
- **Assumptions:** the listed events are a complete-enough proxy for match
  performance; the specific weight values reflect a reasonable but manually chosen
  relative importance (a goal is worth roughly 1.7× an assist, a red card costs more
  than two goals are worth, etc.) — not derived from any statistical fit.
- **Strengths:** deterministic, instant, needs no training data, trivially
  explainable to an end user ("why is this player rated 8.2? +2.0 for the goal,
  +1.2 for the assist...").
- **Weaknesses/limitations:** no context sensitivity (a goal against a weak side
  counts the same as a stunning goal in a final; minutes played isn't a rating
  factor beyond whatever events happened to occur); position-blind (a defender's
  clean sheet doesn't factor in at all, since `clean_sheet` isn't in the weight
  table — **could not determine** whether this is deliberate or an oversight).
- **Complexity:** O(events for that player) — trivial.
- **Interaction with the rest of the system:** called once per match, at the
  live→finished transition, by `run_simulation` (see
  [05 — Simulation Engine](05_SIMULATION_ENGINE.md)); results are pushed to the
  Sporty backend via `POST /api/v1/feed/player-ratings` and served back to the
  frontend from `GET /api/match/{id}/ratings`.
- **Files:** `app/services/rater.py` (the only file; used directly, no separate
  training/loading step since there's no model artifact).

## Explain Like I'm New

Think of the feeder's prediction system like a horse-racing tipster who keeps a
personal notebook of every team's current "form" (that's the Elo rating — like a
chess ranking, but for football/basketball teams), updates it after every match
based on how surprising the result was, and uses the gap between two teams' form to
guess who'll win. A second, more traditional tipster (Dixon-Coles) instead tries to
guess the *exact scoreline* using the classic idea that goals happen somewhat
randomly at a steady rate throughout a match. The project tried both tipsters,
graded them against real results using a fair, no-cheating method (never letting a
tipster "peek" at a match before making its guess), and kept the better one for the
live app — while keeping the other one's code around because it's a legitimate,
working alternative, just not this particular contest's winner.

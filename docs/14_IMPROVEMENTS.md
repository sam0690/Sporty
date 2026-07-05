# 14 — Improvement Suggestions

Every item below is grounded in something concretely observed in the codebase during
this documentation pass (either a comment the code already makes about itself, or a
gap directly verified by inspection) — not a generic best-practices checklist.

## Architecture

- **The Celery worker + Beat run on a local developer machine**, not the hosting
  platform, sharing production Postgres/Redis credentials (a deliberate
  cost-avoidance choice, per [09 — Deployment](09_DEPLOYMENT.md)). This is a real
  single point of failure for scoring/pricing/auto-lock outside the on-finish
  enqueue path: if that machine is off, only the immediate on-finish scoring still
  happens; the 10-minute sweep, daily ranking, repricing, and auto-lock jobs all stop
  until it's back. Moving the worker to a platform-managed process (even a small,
  cheap one) would remove this dependency on a specific machine being powered on and
  connected.
- **Two overlapping sport-config dictionaries** (`SPORT_CONFIGS` and
  `SPORT_CONFIG_REGISTRY` in `app/league/sportConfigs.py`) serve different call
  sites (squad-build quotas vs. lineup starter minimums) but look like they should
  be one source of truth. The module's own comments already flag this as a known
  point of confusion; consolidating into one config keyed by both concerns (or
  clearly namespacing the two) would remove a real "which one applies here" trap for
  future changes.
- **Two independent pricing algorithms write the same `players.cost` column**
  (form-based `repricing.py` via Celery Beat daily, demand+performance blend via
  APScheduler every 4 hours). Both are documented, both are real, but having two
  different pricing philosophies silently interleave on the same column makes price
  movements harder to reason about/debug than a single, unified pricing pipeline
  would be.
- **APScheduler jobs are not evidenced to be lock-guarded against multi-instance
  duplication** the way the Celery/waiver/trade jobs are (`app/core/redis_lock.py`
  is used for those, but this pass did not find the same guard on the in-process
  `app/main.py` lifespan jobs). If the API is ever scaled to more than one instance,
  the daily lifecycle transition, ranking job, cache warming, and window-notification
  jobs would each fire once **per instance** rather than once total — worth
  auditing before horizontally scaling the API process.
- **`trade_offers.offered_player_ids`/`requested_player_ids` are plain `JSON`**,
  while the rest of the schema uses `JSONB` where JSON is stored
  (`live_events.meta`, `match_feed_cache.payload`) — `JSONB` is generally preferable
  in PostgreSQL (binary storage, indexable, faster containment queries) unless there
  was a specific reason to use text-JSON here that the migration doesn't state.

## Performance

- **`score_active_transfer_windows`'s known, accepted gap**: it only re-scores
  currently-**active** windows, so if a match's window has already closed by the
  time its finish event fires and the immediate enqueue fails, nothing else will
  ever pick it back up automatically — a manual/administrative re-score would be
  needed. This is explicitly called out in the code as an accepted limitation for
  live traffic, but it does mean **historical backfills into closed windows** need a
  separate, manual scoring trigger; a small "sweep the last N closed windows too"
  extension would close this gap entirely.
- **No automated retraining/monitoring loop for the feeder's outcome models.** The
  `GET /model-metrics` scorecard exists and is refreshed opportunistically after
  every finished match, but nothing in the repository consumes it to trigger
  retraining or alert on drift — it's a number a human has to go look at.

## Security

- **No dependency-vulnerability scanning was found** (no `pip-audit`/`npm audit`
  CI step, no Dependabot config) despite a real, pinned dependency surface on both
  sides (including `boto3`, `pyjwt`/`python-jose`, `firebase-admin`) that could
  develop known CVEs over time.
- **No CI/CD pipeline at all** (see [09 — Deployment](09_DEPLOYMENT.md)) means the
  existing backend test suite and frontend lint step aren't guaranteed to run
  before code reaches production — a regression (including a security regression)
  could ship without ever being checked automatically.
- **Frontend has no working automated test runner** — `__tests__/example.spec.ts`
  references Playwright, but there is no `playwright.config` or wired-up `test`
  script (noted directly in the root `CLAUDE.md`). Frontend correctness currently
  relies entirely on manual testing and TypeScript's type checking.

## Model / Simulation

- **Simulations are not reproducible** — no random seed is ever set (see
  [05 — Simulation Engine](05_SIMULATION_ENGINE.md)). For demo purposes this is a
  feature, but it makes a reported simulation bug ("this match produced an
  impossible stat line") impossible to reproduce exactly from a bug report alone;
  optionally accepting a seed parameter on `POST /simulate` (falling back to
  unseeded behavior by default) would preserve the current product feel while
  making debugging and automated testing of the simulation loop far easier.
- **`features.py`'s `MIN_FORM_ROWS = 5` constant is defined but not actually used**
  as the cold-start trigger — the real check is "zero stat rows or zero total
  minutes," which means a player with, say, 1 low-confidence stat row is treated as
  a fully warm, trained player rather than a partial cold-start. Actually gating on
  `MIN_FORM_ROWS` (or blending toward the neutral fallback as row count grows) would
  make the form index more honest about players with very little history.
- **Basketball's production Elo bundle deliberately drops a backtest-proven-useful
  feature** (rest days / back-to-back game flags) purely because the live serving
  path has no schedule feed — an honestly documented scope cut, but a concrete,
  actionable next step: wiring a real schedule source into the prediction path would
  let the already-validated `elo_rest`/`elo_mov_rest` configurations actually ship.
- **Dixon-Coles is a fully working, validated alternative model that is unreachable
  from any live endpoint** (`predict_outcome_v2` only accepts `kind ==
  "elo_logistic"` bundles). If its full scoreline distribution (not just win/draw/
  loss) would ever be useful product-side — e.g. a "predicted scoreline" UI feature —
  the model is already there and tested; it just needs a bundle format + a serving
  path.
- **No penalty-kick or injury simulation** — both are absent by design/scope today
  (see [05 — Simulation Engine](05_SIMULATION_ENGINE.md)), but the backend's
  `FootballStat.penalties_saved`/`penalties_missed` columns exist and are always
  zero from the current data source, which could confuse anyone building a feature
  against those columns without reading this far into the docs.

## Code quality

- **The `players` table dedup migration explicitly leaves a known follow-up
  undone**: it cleans up existing duplicate rows but does **not** add a uniqueness
  constraint, because the importers themselves still need to learn to match by
  name+team rather than `external_api_id` alone — otherwise the next cross-namespace
  import would immediately recreate the problem it just fixed. That importer change
  is the actual fix; the migration is a one-time cleanup, not a permanent guarantee.
- **Club logo URL is stored in two places** (`real_teams.logo_url` and
  `players.real_team_logo_url`) added via two separate migrations — worth
  consolidating or clearly documenting which one is authoritative to avoid the two
  drifting apart over time.
- **Backend dev/runtime port conventions are inconsistent**: the backend
  `CLAUDE.md`'s example dev command uses `--port 10000`, the Dockerfile's default is
  also `10000`, but the frontend's dev proxy and `docker-compose.yml` both default
  to backend port `8000` — anyone following the backend's own quick-start command
  literally will break the frontend's dev proxy unless they know to override one
  side. Picking one canonical port (or making the frontend's default match the
  backend's) would remove this recurring dev-environment trap.

## Scalability

- **The in-process APScheduler + a single local Celery worker/beat** are both
  scale-to-one patterns by construction — see Architecture above. Neither is a
  latent bug today (traffic evidently doesn't require more), but both are worth
  revisiting together if/when the platform needs more than one API instance or
  meaningfully more background-job throughput.
- **The dormant Kafka realtime pipeline** exists specifically as "the design for
  real scale" (per the codebase's own framing) but is explicitly untested in
  production. If live-match traffic ever grows enough that the current
  Redis-pub/sub-per-match model becomes a bottleneck, that pipeline is the
  documented next step rather than a from-scratch redesign — but it would need real
  production testing before being trusted, since the repository itself flags it as
  not prod-tested.

## Explain Like I'm New

None of the items above are "this code is broken" — they're "here's a thing the
project already knows about itself, or a loose end left on purpose, worth revisiting
before it causes a surprise later." Several are literally comments the original
authors left in the code admitting a trade-off (e.g. "the Celery worker runs
locally to save money," "this migration deliberately doesn't add a constraint yet")
— this chapter just collects them in one place with the "so what should happen
next" made explicit.

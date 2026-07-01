# 05 — Squads, Transfers & Optimization

This chapter covers three related things: the **sport configuration** that defines squad shape,
the **transfer** flow (both the simple swap and the Redis-backed staging session), and the two
**PuLP integer-linear-programming** solvers (auto-pick and the lineup optimizer).

## Sport configuration (`app/league/sportConfigs.py`)

This file defines squad sizes, quotas, per-club limits, and position minimums. Be aware it has
**two overlapping dicts** (the module and `Sporty_Backend/CLAUDE.md` both flag this):

- **`SPORT_CONFIGS`** — squad sizes + per-club + position minimums used by the **auto-pick** path:
  - `football`: `squad_size=15`, `quota=15`, `maxPerClub=3`, minimums `{GKP:1, DEF:3, MID:2, FWD:1}`.
    Position codes must match `Player.position` exactly (`"GKP"`, not `"GK"`) or the ILP rejects
    the pool.
  - `basketball`: `squad_size=13`, `quota=13`, `maxPerClub=None`, **no** position minimums
    (all NBA players are position `"UNK"`; the quota fixes the count).
  - `mixed`: `squad_size=15`, `football_quota=8`, `basketball_quota=7`.
- **`SPORT_CONFIG_REGISTRY`** — single vs mixed **starter** minimums used elsewhere (lineup
  validation). Football single starters `{GKP:2, DEF:5, MID:5, FWD:3}`, mixed `{GKP:1, DEF:2,
  MID:3, FWD:2}`; basketball single `{UNK:15}`, mixed `{UNK:7}`.

`DEFAULT_MAX_PER_CLUB = 3`. `derive_sport_type(sports)` classifies a list of sport names/objects
into `"football"`/`"basketball"`/`"mixed"` (more than one distinct sport → mixed).
`build_auto_pick_sport_config(sport_type, total_budget, squad_size)` assembles the config dict
the ILP consumes, pulling the correct per-sport quotas + minimums (for mixed, the minimums come
from the registry's `mixed` entries, because the single-league minimums assume full 15/13-player
squads and would be infeasible at 8+7).

## Transfers — two code paths

There are **two** transfer implementations in the codebase; know which is which.

### 1. Simple swap (`app/league/services.py:make_transfer`)

`POST /leagues/{id}/transfers`. One player out, one player in, committed immediately. Enforces:
league ACTIVE, a current window with transfers not locked, `player_out` owned, `player_in`
available, budget sufficient after refunding the outgoing player's **acquisition** cost (not
current cost — a deliberate design choice noted in the code: refunding acquisition cost avoids
"buy low, sell high" market-gaming), and the per-window transfer cap
(`League.transfers_per_window`).

### 2. Staged transfer session (`app/api/v1/transfers.py` + `app/services/transfer_service.py`)

This is the richer flow used by the transfers UI: stage several ins/outs, see live budget/limit
feedback, then confirm atomically. State lives in **Redis** (`session:{user_id}`, 1h TTL,
`app/services/transfer_session_service.py`) so partial edits survive across requests without
touching the DB. Endpoints under `/api/v1/transfers`:

- **`POST /stage-out`** (`transfer_service.stage_out`) — marks a player pending-out, refunds its
  acquisition cost (minus a fixed `0.10` penalty from `app/services/budget_utils.py:calculate_refund`)
  to the session's running budget.
- **`POST /stage-in`** (`transfer_service.stage_in`) — validates the incoming player is in the
  league's allowed sport pool, checks budget, the remaining transfer count, the squad-size cap,
  and — for **mixed leagues** — the per-sport roster caps (`{football:8, basketball:7}`). Adds
  to pending-in and deducts the price from the session budget.
- **`POST /confirm`** (`transfer_service.confirm_transfers`) — re-validates everything against
  the DB at confirm time (final squad must equal `max_total`; mixed leagues must land exactly on
  8+7), then atomically: releases the outgoing `TeamPlayer` rows (`released_window_id = window`),
  writes `BudgetTransaction` refund/cost rows, inserts new `TeamPlayer` rows, writes `Transfer`
  audit rows as swap pairs, updates `current_budget`, and syncs Redis mirrors
  (`team:{user_id}`, `budget:{user_id}`, `player:prices`). Redis failures here are logged but
  don't fail the request (the DB is the source of truth).
- **`DELETE /cancel`** — drops the Redis session.

The target window for a confirm is the **editable** (next not-yet-locked) window, via
`_current_window_id` (`TransferWindow.lineup_deadline_at > now()`).

> Note: the two paths coexist. The staged flow is what the transfers dashboard uses; `make_transfer`
> is the single-shot league endpoint. Both write the same `Transfer`/`TeamPlayer` audit rows.

## The ILP solvers (PuLP)

Sporty uses **integer linear programming** (via PuLP + the CBC solver) in two places. Both model
each player as a binary decision variable and maximize projected value/points subject to squad,
budget, position, club, and lock/ban constraints.

### Auto-pick a full squad (`app/league/auto_pick_service.py`)

`POST /leagues/{id}/auto-pick` suggests a complete, valid squad (it **does not persist** — it
returns a suggestion). Flow:
1. **Build the player pool** (`_load_player_pool` / `_fetch_player_pool`). Each candidate becomes
   a `PoolPlayer` with a `value` = average historical `fantasy_points` ÷ `cost` (a value-per-cost
   proxy). The pool is cached in Redis for 30 min (per sport type), with basketball availability
   re-checked live against the DB.
2. **Solve** (`auto_pick_ilp`). It builds a `pulp.LpProblem` maximizing `Σ jittered_value·x_i`,
   where each player's value gets a random **jitter** of ±`AUTO_PICK_JITTER_STRENGTH` (0.55) so
   repeated auto-picks produce different-but-good squads instead of the same optimum every time.
   Constraints:
   - total selected == `squad_size`;
   - locked players forced to 1 (`x_i == 1`);
   - `Σ cost·x_i <= budget` (+ tiny epsilon for float safety);
   - per sport: selected == that sport's quota, and each position's count ≥ its minimum;
   - per club: `Σ x_i <= maxPerClub`.
   Solves with `PULP_CBC_CMD(msg=0)`. Non-optimal status → a helpful `ValueError`.
3. **Validate** the result (`validate_squad`) against the same constraints as a defensive
   double-check, and return the squad + total cost + budget remaining.

Auto-pick is allowed in SETUP (initial build) and ACTIVE leagues (but disabled once the transfer
window is locked). A per-user+league Redis lock (`autopick:lock:...`, 10s) prevents concurrent runs.

### Lineup optimizer (`app/services/optimization/ilp_optimizer.py`)

`POST /api/v1/optimization/lineup` (`app/optimization/router.py`) is a more general, stateless
optimizer. The client posts candidate players + constraints; the server returns the optimal
selection **plus captain and vice-captain**. The model (`optimize_lineup`) uses three binary
variables per player:
- `x_i` — selected in the squad,
- `c_i` — is captain,
- `v_i` — is vice-captain.

Objective: `Σ x_i·pts + c_i·pts + v_i·(pts·vice_bonus_multiplier)` — i.e. the captain's points
count **twice** (once via `x`, once via `c`), and the vice adds a configurable fraction. A tiny
`-0.000001·Σ cost·x_i` term breaks ties toward cheaper equal-value squads. Constraints: squad
size, budget, per-position (`exact` or `min/max`), per-sport, per-club `maxPerClub`, exactly one
captain and one vice (`Σc == 1`, `Σv == 1`), captain/vice must be selected (`c_i <= x_i`,
`v_i <= x_i`), and a player can't be both (`c_i + v_i <= 1`). Locked players forced to 1; banned
players filtered out. If infeasible, `_diagnose_infeasible` explains *why* (budget too low,
missing a required position, locked∩banned overlap, not enough available players, …) rather than
returning an opaque failure.

Both solvers are pure functions over their inputs, which is why the test suite
(`tests/test_ilp_optimizer.py`) can exercise them without a database.

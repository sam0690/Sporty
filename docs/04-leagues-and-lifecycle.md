# 04 — Leagues & Lifecycle

Leagues are the container for everything a user does. This chapter covers the league lifecycle
state machine, the two league modes (draft vs budget), the snake draft algorithm, transfer-
window generation, membership/joining, and the daily lifecycle automation.

Everything here lives in `app/league/` — `router.py` (the HTTP surface, ~900 lines),
`services.py` (the business logic, ~2700 lines), `models.py`, `schemas.py`,
`dependencies.py` (member/owner guards). Routes are mounted at `/api/v1/leagues`.

## The lifecycle state machine

`League.status` is a `LeagueStatus` enum: **SETUP → DRAFTING → ACTIVE → COMPLETED** (linear, no
rollback). Transitions are enforced in the **service layer**, not the DB — a CHECK constraint
can only see the new row, not the old value, so "old must be X to set Y" can't be a constraint.

Two modes change the path:
- **Draft leagues** (`draft_mode=True`): `SETUP → DRAFTING → ACTIVE → COMPLETED`. They must
  enter DRAFTING before ACTIVE (can't skip).
- **Budget leagues** (`draft_mode=False`): `SETUP → ACTIVE → COMPLETED`. They have no drafting
  phase; the service rejects a budget league trying to go DRAFTING.

`update_league_status` (`services.py`) is owner-only and validates the transition, raising 409
for invalid ones. For budget SETUP→ACTIVE it also enforces a minimum member count
(`LEAGUE_MIN_MEMBERS_TO_ACTIVATE`, default 2).

### Automatic lifecycle (`app/services/league_status_service.py`)

A daily APScheduler job (`_run_league_lifecycle_job` in `main.py`, 00:00 UTC) calls
`auto_update_league_statuses`, which is idempotent and does two date-driven transitions:
- **SETUP → ACTIVE** for budget-mode leagues whose `start_date <= today` — but only if the
  active-member count meets `LEAGUE_MIN_MEMBERS_TO_ACTIVATE` (otherwise it's skipped and counted).
- **ACTIVE → COMPLETED** for leagues whose `end_date < today`.
Each transition fires notifications (`notify_league_active` / `notify_league_completed`).

## Creating a league (`services.create_league`)

`POST /leagues`. Any authenticated user can create one. The service:
1. Rejects a duplicate `(season_id, name)`.
2. Generates a unique 8-char invite code (`_generate_invite_code`).
3. Validates the season and its sport (must be a supported league sport).
4. Derives `squad_size` from the requested sports via
   `derive_sport_type(...)` + `SPORT_CONFIGS` (see [05](05-squads-transfers-optimization.md)) —
   football=15, basketball=13, mixed=15.
5. Attaches the requested sports as `LeagueSport` rows (at least one required — no default
   fallback).
6. **Auto-enrols the owner** as the first `LeagueMembership` in the same transaction (so the
   owner can immediately draft/set lineups; doing it separately risks a half-state where the
   owner is locked out of their own league).

The creator becomes owner + member. `GET /leagues` returns leagues the user is a **member** of
(queried through `LeagueMembership`, so it includes both owned and joined leagues).

## Joining (`services.join_league`)

`POST /leagues/join` with an invite code. Guards: code must resolve to a league, the league
must be in SETUP (no joining mid-draft — but see mid-season join below), the user must not
already be a member, and the league must not be full. `GET /leagues/discover` lists public
leagues currently accepting joins (setup leagues + active budget leagues that allow mid-season
joins). Owners toggle mid-season joining via `PATCH /leagues/{id}/midseason-join`.

## Draft leagues — the snake draft

### Starting the draft (`services.start_draft`)

`POST /leagues/{id}/draft/start` (owner only, SETUP only, ≥2 members, ≥1 sport attached).
Atomically:
1. **Randomises** each member's `draft_position` (shuffle 1..N).
2. Creates a `FantasyTeam` for every member (name defaults to `"{username}'s Team"`, budget =
   `league.budget_per_team`). Users are bulk-loaded in one query to avoid N+1.
3. Transitions the league to **DRAFTING**.

Teams are created here (not lazily) so every member is guaranteed a team to assign picks to.

### Whose turn is it? (`services.get_current_draft_turn`)

The draft order is a **snake** (a.k.a. serpentine). With N members and `squad_size` rounds,
there are `N × squad_size` total picks. For the overall 1-based `pick_number`:

```
round_number       = ((pick_number - 1) // N) + 1
index_within_round =  (pick_number - 1) %  N          # 0-based
position_in_round  = index_within_round + 1           if round is ODD  (1,2,…,N ascending)
                   = N - index_within_round           if round is EVEN (N,…,2,1 descending)
```

The member whose `draft_position` equals `position_in_round` is on the clock. Odd rounds go
low→high draft position; even rounds reverse — so the player who picked last in round 1 picks
first in round 2. This is the classic fairness mechanism: it balances the advantage of an early
first pick.

### Making a pick (`services.make_draft_pick`)

`POST /leagues/{id}/draft/pick`. Guards, in order: league is DRAFTING; draft isn't already
complete; it's the caller's turn; the player exists and `is_available`; the player's sport is
attached to the league; the player isn't already drafted in this league; the caller's squad
isn't full (`< squad_size`); and the player's cost fits the team's remaining budget. On success
it writes a `DraftPick` (immutable audit), a `TeamPlayer` (roster), and deducts the cost from
`current_budget`. **When the last pick is made** (`pick_number >= total_picks_possible`), the
league auto-transitions **DRAFTING → ACTIVE** — deterministic, so the league never gets stuck
with nothing left to pick.

## Budget leagues — direct team build

`POST /leagues/{id}/teams/build` (`services.build_initial_team`). For budget mode, users pick
their whole starting squad directly under budget instead of drafting. Guards: budget mode,
SETUP status, no existing team, all players available and in the league's sports, total cost ≤
`budget_per_team`, and exactly `squad_size` players. Users can also generate a squad
automatically with the ILP **auto-pick** (`POST /leagues/{id}/auto-pick`, see
[05](05-squads-transfers-optimization.md)), or **discard** a player for a refund
(`DELETE /leagues/{id}/teams/players/{player_id}`, with a small transaction penalty).

## Transfer windows (gameweeks)

`POST /leagues/{id}/transfer-windows/generate` (`services.generate_transfer_windows`, owner-
only, budget-mode, SETUP) creates one `TransferWindow` per week on the league's `transfer_day`,
each with its `transfer_deadline_at` and later `lineup_deadline_at`. These windows are what all
scoring, pricing, and locking key on.

Two "which window?" helpers matter across the app:
- **`get_active_transfer_window`** (`GET /leagues/{id}/active-window`) — the window that
  contains "now".
- **`get_editable_transfer_window`** (`GET /leagues/{id}/editable-window`) — the **next
  not-yet-locked** window (the one you set up while the current one plays). Internally the
  transfer/lineup services locate this via `TransferWindow.lineup_deadline_at > now()` ordered
  by `start_at` — you edit the upcoming gameweek, not the in-progress one. This distinction is
  what surfaces "editing GW N while GW N-1 is live" in the UI.

## Setting a lineup (`services.update_lineup`)

`PATCH /leagues/{id}/my-team/lineup` (POST alias for legacy). Sets the starting XI + captain +
vice for the **editable** window. It:
1. Confirms the lineup window isn't locked (`validate_transfer_window_for_lineup` — checks both
   the explicit `lineup_locked` flag and the `lineup_deadline_at`).
2. Verifies all submitted players are on the user's squad.
3. Runs structural validation (`validate_lineup_for_league_type` — starter/bench counts and,
   for mixed leagues, per-sport starter minimums) and position-slot validation
   (`validate_position_slots` against the league's `LineupSlot` rules).
4. Requires captain and vice to be in the lineup and distinct.
5. Clears the existing `TeamGameweekLineup` rows for the window and writes new ones with the
   captain/vice flags.

`GET /leagues/{id}/my-team/lineup` returns the squad plus the current window's starters.

## Membership exit

`POST /leagues/{id}/leave` removes a non-owner's membership and their team data in that league,
and cancels any in-flight Redis transfer session. Owners delete the whole league
(`DELETE /leagues/{id}`), which cascades to all child config and team data. The leaderboard can
still show departed users in historical standings (`historical=True`, see
[06](06-scoring-ranking-pricing.md)).

# 08 — API Reference

All backend REST endpoints, grouped by router, with method, path, auth requirement,
purpose, and the error codes that matter. Full request/response **schemas** live in
the FastAPI-generated OpenAPI docs (`/docs`, `/openapi.json` — auto-derived from the
Pydantic models in each slice's `schemas.py`, not duplicated here since they are
already machine-readable and always in sync with the code). This chapter is the
catalogue and the business rules a schema alone can't show.

**Auth key:** 🔓 = no auth. 🔒 = cookie-JWT (`get_current_active_user`). 🔒+M = 🔒 +
league membership (`require_league_member`). 🔒+O = 🔒 + league ownership
(`require_league_owner`). 🔒+A = 🔒 + admin-tier role (`require_admin_role`,
`app/admin/dependencies.py` — `support`/`admin`/`super_admin`; rows marked
*(super)* require `super_admin`). 🔑 = feeder shared-secret (`X-Feeder-Secret`), a
distinct trust boundary from user auth. All authenticated routes additionally
require a valid `X-CSRF-Token` header on non-GET verbs (see
[10 — Security](10_SECURITY.md)).

## Auth (`/api/v1/auth`, `app/auth/router.py`)

| Method | Path | Auth | Purpose | Key errors |
|---|---|---|---|---|
| POST | `/register` | 🔓 | Create a user; `auto_login=true` also sets cookies | `409` duplicate username/email |
| POST | `/login` | 🔓 (rate-limited 10/min) | Username/email + password → sets `access_token`+`refresh_token` cookies | `401` bad credentials |
| POST | `/google` | 🔓 | Google sign-in/up via authorization code | `409` email exists under a different auth method (returns a link token) |
| POST | `/google/link` | 🔒 | Complete linking a Google identity to an existing local account using the one-time link token from the 409 above | `400` invalid/expired link token |
| POST | `/refresh` | 🔓 (rate-limited 20/min) | Rotate the refresh token, reissue both cookies | `401` invalid/expired/revoked refresh token |
| POST | `/forgot-password` | 🔓 (rate-limited 3/min) | Email a password-reset link | Always `200` (doesn't reveal whether the email exists) |
| POST | `/reset-password` | 🔓 (rate-limited 5/min) | Consume the reset token, set a new password, revoke all sessions | `400` invalid/expired token |
| POST | `/logout` | 🔒 | Revoke the current refresh token, clear cookies | — |
| POST | `/logout/all` | 🔒 | Revoke every refresh token for the user | — |
| GET | `/me` | 🔒 | Current user profile — the frontend's session-bootstrap call | `401` no/expired session |
| POST | `/change-password` | 🔒 | Verify current password, set new, revoke all sessions | `400` wrong current password |

## Leagues (`/api/v1/leagues`, `app/league/router.py` — the largest router, ~900 lines)

| Method | Path | Auth | Purpose | Key errors |
|---|---|---|---|---|
| GET | `/sports` | 🔒 | List platform sports | — |
| GET | `/seasons` | 🔒 | List seasons | — |
| GET | `` | 🔒 | Leagues the caller is a member of | — |
| GET | `/discover` | 🔒 | Public leagues currently open to join | — |
| GET | `/me/transfers` | 🔒 | Caller's transfer history across leagues | — |
| POST | `` | 🔒 | Create a league (auto-enrols owner) | `400` invalid sport(s)/season |
| POST | `/join` | 🔒 | Join via invite code | `404` bad code, `409` already a member/league full/not in SETUP |
| GET | `/{league_id}` | 🔒+M | League detail | `404` |
| PATCH | `/{league_id}` | 🔒+O | Edit league settings | `409` invalid field for current status |
| DELETE | `/{league_id}` | 🔒+O | Delete league (cascades) | — |
| PATCH | `/{league_id}/midseason-join` | 🔒+O | Toggle mid-season joining | — |
| PATCH | `/{league_id}/status` | 🔒+O | Manual lifecycle transition | `409` invalid transition (see [02 — Architecture](02_ARCHITECTURE.md)/league state machine) |
| POST | `/{league_id}/renew` | 🔒+O | Start the next season of this league; `dynasty=true` carries rosters over as `dynasty_carryover` moves (keeper/dynasty leagues) | `409` league/season not eligible |
| GET | `/{league_id}/seasons` | 🔒+M | Every season in this league's rollover lineage | — |
| PATCH | `/{league_id}/sports/{sport_name}/season` | 🔒+O | Re-point a secondary sport's season mapping (multi-sport leagues) | `409` overlap/eligibility violation |
| POST | `/{league_id}/leave` | 🔒+M | Leave a league (non-owner) | `403` owner cannot leave |
| POST | `/{league_id}/sports` | 🔒+O | Attach a sport | `409` league not in SETUP |
| DELETE | `/{league_id}/sports/{sport_name}` | 🔒+O | Detach a sport | — |
| POST | `/{league_id}/lineup-slots` | 🔒+O | Define position min/max per sport | — |
| GET | `/{league_id}/members` | 🔒+M | Membership list | — |
| DELETE | `/{league_id}/members/{membership_id}` | 🔒+O | Remove a member from the league | — |
| POST | `/{league_id}/draft/start` | 🔒+O | Randomize draft order, create teams, → DRAFTING | `409` not SETUP / <2 members / no sport attached |
| POST | `/{league_id}/draft/pick` | 🔒+M | Make a snake-draft pick | `409` not caller's turn / player unavailable / squad full / budget exceeded |
| GET | `/{league_id}/draft/turn` | 🔒+M | Whose turn it is | — |
| POST | `/{league_id}/teams/build` | 🔒+M | Build a full squad directly (budget leagues) | `400` wrong player count / over budget |
| POST | `/{league_id}/auto-pick` | 🔒+M | PuLP ILP squad suggestion (does not persist) | `422` infeasible (see [06 — Algorithms](06_ALGORITHMS.md) §1) |
| DELETE | `/{league_id}/teams/players/{player_id}` | 🔒+M | Discard a player for a refund (with penalty) | `404` not owned |
| GET | `/{league_id}/my-team` | 🔒+M | Caller's squad + budget | — |
| POST | `/{league_id}/transfer-windows/generate` | 🔒+O | Create the season's weekly gameweeks | `409` not budget mode / not SETUP |
| POST | `/{league_id}/transfers` | 🔒+M | Single-shot transfer (see [06 — Algorithms](06_ALGORITHMS.md)/`make_transfer`). A budget shortfall can optionally be paid with league points at the global `BUDGET_OVERAGE_POINTS_RATE` — the deduction is recorded in `points_penalties` and shown against the team's total | `409` window locked / transfer cap reached / insufficient budget (and not covering with points) |
| GET | `/{league_id}/transfers` | 🔒+M | Transfer history | — |
| GET / PATCH / POST | `/{league_id}/my-team/lineup` | 🔒+M | Read/set the starting XI + captain/vice for the editable window (`PATCH` is canonical, `POST` a legacy alias) | `409` lineup window locked, `400` structural/position-slot violation, captain==vice |
| GET | `/{league_id}/my-team/gameweek-recap` | 🔒+M | Per-window scoring breakdown including auto-subs applied | — |
| GET | `/{league_id}/my-team/live-lineup` | 🔒+M | Caller's lineup for the in-progress gameweek (live-match view) | — |
| GET | `/{league_id}/active-window` | 🔒+M | The window containing "now" | — |
| GET | `/{league_id}/editable-window` | 🔒+M | The next not-yet-locked window | — |
| GET | `/{league_id}/dashboard/stats` | 🔒+M | Summary stats for the league home page | — |
| GET | `/{league_id}/leaderboard` | 🔒+M | Standings (per-window or season-total; `historical` flag) | — |
| GET | `/{league_id}/power-rankings` | 🔒+M | Rank movement, streaks, manager of the week | — |
| GET | `/{league_id}/activity` | 🔒+M | League activity feed (drafts, transfers, waivers, trades, dynasty carryovers — newest first) | — |

## Squads, Transfers & Optimization (`/api/v1/transfers`, `/api/v1/optimization`)

| Method | Path | Auth | Purpose | Key errors |
|---|---|---|---|---|
| POST | `/transfers/stage-out` | 🔒+M | Stage a player out in the Redis transfer session | `409` not owned / window locked |
| POST | `/transfers/stage-in` | 🔒+M | Stage a player in (budget/position/mixed-sport-cap checks) | `409` over budget / squad full / sport cap exceeded |
| POST | `/transfers/confirm` | 🔒+M | Atomically commit the staged session to the DB | `409` re-validation failure (squad size/mixed-sport split mismatch at confirm time) |
| DELETE | `/transfers/cancel` | 🔒+M | Discard the staged session | — |
| POST | `/optimization/lineup` | 🔒 | Stateless ILP lineup + captain/vice optimizer (client supplies candidates+constraints) | `422` infeasible, with a human-readable reason (`_diagnose_infeasible`) |

## Draft-league roster management — free agents, waivers, trades (`/api/v1/leagues/{league_id}/...`)

Draft leagues only; budget leagues use the transfer endpoints above instead. See
[06 — Algorithms](06_ALGORITHMS.md) §5 and [07 — Database](07_DATABASE.md).

| Method | Path | Auth | Purpose | Key errors |
|---|---|---|---|---|
| GET | `/free-agents` | 🔒+M | List undrafted/released players available to add | — |
| POST | `/free-agents/claim` | 🔒+M | Immediately add a free agent (drop required) | `409` player not free / position-minimum violation / squad-ownership index conflict |
| GET | `/waivers` | 🔒+M | This team's waiver claims | — |
| GET | `/waivers/order` | 🔒+M | League waiver priority order | — |
| POST | `/waivers` | 🔒+M | Submit a waiver claim (add+drop) for the next processing window | `409` invalid add/drop pairing |
| PUT | `/waivers/order` | 🔒+M | Reorder the caller's own pending claims | `409` id set mismatch |
| DELETE | `/waivers/{claim_id}` | 🔒+M | Cancel a pending claim | `409` not pending / not owner |
| GET | `/trades` | 🔒+M | Trades involving the caller's team | — |
| GET | `/trades/rosters` | 🔒+M | Every team's active roster (for building a trade offer) | — |
| POST | `/trades` | 🔒+M | Propose a trade | `400` uneven/invalid player sets |
| POST | `/trades/{trade_id}/accept` | 🔒+M | Accept → opens the 24h veto window | `409` wrong status / not the offer's recipient |
| POST | `/trades/{trade_id}/reject` | 🔒+M | Reject a proposal | — |
| POST | `/trades/{trade_id}/cancel` | 🔒+M | Cancel (proposer only) | — |
| POST | `/trades/{trade_id}/veto` | 🔒+O | Commissioner veto of an accepted, not-yet-executed trade | `409` already executed |

## Head-to-head matchups (`/api/v1/leagues/{league_id}/matchups`, `app/api/v1/matchups.py`)

Opt-in per league (`is_head_to_head=true` at creation; mutually exclusive with
mid-season joining). The full-season schedule is a **circle-method round robin**
generated once at the ACTIVE transition; results resolve automatically after each
window's scoring lands. See [06 — Algorithms](06_ALGORITHMS.md) §11.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `` | 🔒+M | Matchup scoreboard for one window (defaults to the current window via `window_id`; `include_all=true` returns the whole season's schedule) |
| GET | `/standings` | 🔒+M | W-L-T standings — wins desc, points-for as the tiebreaker |

## Players (`/api/v1/players`, `app/player/router.py`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `` | 🔒 | Paginated/filtered player list (sport, position, availability, search) |
| GET | `/stats` | 🔒 | Gameweek stats across players |
| GET | `/{player_id}` | 🔒 | Player detail |
| GET | `/{player_id}/stats/{gameweek_id}` | 🔒 | One player's stat line for one window |
| GET | `/{player_id}/price-history` | 🔒 | `PlayerPriceHistory` audit trail |

## Scoring config (`/api/v1/scoring/rules/*`)

| Method | Path | Auth | Purpose | Key errors |
|---|---|---|---|---|
| GET | `/scoring/rules/{sport_name}` | 🔒 | Platform default scoring rules | — |

Per-league scoring overrides (`/leagues/{id}/scoring-overrides`) were **retired**
(2026-07): `fantasy_points` is read directly by auto-pick valuation, pricing, and
"my team" display, none of which are league-aware, so scoring is
`DefaultScoringRule`-only platform-wide.

## Matches — public discovery (`/api/v1/matches`, `app/match/router.py`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/matches` | 🔒 | All fixtures (any authenticated user — matches are a public discovery surface, not gated by league membership) |
| GET | `/matches/public` | 🔓 | Fixtures without requiring login (marketing/landing surface) |

## Realtime — WebSocket, SSE, match state (`/api`, async DB + Redis)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| WS | `/ws/match/{match_id}` | 🔒 (cookie) | Live score/points event stream for one match |
| WS | `/ws/leaderboard/{match_id}` | 🔒 (cookie) | Live leaderboard delta stream |
| GET (SSE) | `/match/{match_id}/leaderboard/stream` | 🔒 (cookie) | SSE alternative to the leaderboard WebSocket |
| GET (SSE) | `/leagues/{league_id}/draft/stream` | 🔒+M | Live draft-pick updates during a snake draft |
| GET | `/match/{match_id}/state` | 🔒 | Authoritative snapshot: score, event timeline, per-player points, lineups |
| GET | `/model-metrics` | 🔒 | Feeder-pushed prediction-accuracy scorecard (cached in Redis; `404` if none pushed yet) |
| GET | `/match/{match_id}/prediction` | 🔒 | Pre-match outcome probabilities (Redis cache → `match_feed_cache` DB fallback) |
| GET | `/match/{match_id}/ratings` | 🔒 | Post-match player ratings + man-of-match |

## Feeder ingestion (`/api/v1/feed`, server-to-server, CSRF-exempt)

| Method | Path | Auth | Purpose | Key errors |
|---|---|---|---|---|
| POST | `/schedule-match` | 🔑 | Register a simulated fixture (idempotent on `external_api_id`) | — |
| DELETE | `/schedule-match/{sporty_match_id}` | 🔑 | Remove a scheduled (not-yet-live) match | `409` already live/finished |
| POST | `/register-players` | 🔑 | Create feeder-owned players for a throwaway demo | — |
| POST | `/resolve-players` | 🔑 | Map a feeder lineup onto real, already-drafted players by folded name | — |
| POST | `/match-result` | 🔑 | Core per-minute event push (idempotent upsert; triggers scoring on finish) | — |
| POST | `/prediction` | 🔑 | Cache pre-match probabilities (24h TTL + durable backstop) | — |
| POST | `/model-metrics` | 🔑 | Push the model-accuracy scorecard | — |
| POST | `/player-ratings` | 🔑 | Cache post-match ratings | — |
| POST | `/match-lineups` | 🔑 | Cache starting lineups | — |
| POST | `/demo-setup` | 🔑 | Idempotently wire a demo user/league/team so a simulated match credits someone's total | — |

All 🔑 routes: `503` if `FEEDER_SECRET` isn't configured server-side, `401` on a
header mismatch (`secrets.compare_digest`, constant-time). See
[10 — Security](10_SECURITY.md).

## Users & Notifications

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/users` | 🔒 | List active users |
| GET | `/users/me/activity` | 🔒 | Caller's recent activity feed |
| GET | `/users/{user_id}` | 🔒 | Public profile |
| GET | `/users/{user_id}/activity` | 🔒 | Another user's activity |
| GET | `/users/{user_id}/public-stats` | 🔒 | Public profile stats |
| PATCH | `/users/{user_id}` | 🔒 | Update own profile (self-only, enforced in the service) |
| POST | `/users/{user_id}/avatar` | 🔒 | Upload avatar → Cloudflare R2 (`storage_service.upload_avatar`) | `503` R2 not configured, `502` upload failure |
| DELETE | `/users/{user_id}` | 🔒 | Deactivate account (soft delete, `204`) |
| POST | `/users/me/favourites/teams/{sport_name}` | 🔒 | Set (or replace) the caller's favourite team for a sport |
| DELETE | `/users/me/favourites/teams/{sport_name}` | 🔒 | Remove the caller's favourite team for a sport |
| POST | `/users/me/favourites/players/{sport_name}` | 🔒 | Set (or replace) the caller's favourite player for a sport |
| DELETE | `/users/me/favourites/players/{sport_name}` | 🔒 | Remove the caller's favourite player for a sport |
| GET | `/notifications` | 🔒 | Caller's notifications |
| PATCH | `/notifications/{id}/read` | 🔒 | Mark one notification read |

Favourites are one team + one player **per sport** (see
[07 — Database](07_DATABASE.md)), set during the post-signup onboarding step
(`/onboarding/favourites` in the frontend, skippable) or later from Profile
Settings; they drive the personalized "your player scored" notifications.

## Support tickets (`/api/v1/support`, `app/support/router.py`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/tickets` | 🔒 | Open a support ticket (subject, category, priority, optional league) |
| GET | `/tickets` | 🔒 | List the caller's tickets |
| GET | `/tickets/{ticket_id}` | 🔒 | One ticket + its message thread (internal admin notes excluded) |
| POST | `/tickets/{ticket_id}/messages` | 🔒 | Reply on one of the caller's tickets |

## Admin (`/api/v1/admin`, `app/admin/router.py` — all routes 🔒+A)

Every mutating action here is written to `admin_audit_logs`. Rows marked *(super)*
require the `super_admin` role; everything else needs `support` or above.

| Method | Path | Purpose |
|---|---|---|
| GET | `/audit-log` | List admin audit-log entries |
| GET | `/users`, `/users/{id}` | List / inspect users |
| POST | `/users/{id}/suspend`, `/users/{id}/reactivate` | Suspend / reactivate an account |
| POST | `/users/{id}/force-logout` | Revoke every session for a user |
| PATCH | `/users/{id}/role` | Change a user's role *(super)* |
| DELETE | `/users/{id}` | Delete a user *(super)* |
| GET | `/leagues` | List all leagues platform-wide |
| PATCH | `/leagues/{id}/status`, `/leagues/{id}/settings` | Override a league's lifecycle status / settings |
| DELETE | `/leagues/{id}` | Force-delete a league |
| GET / POST | `/seasons` | List all seasons / create a season |
| PATCH | `/seasons/{id}` | Update a season |
| POST | `/seasons/{id}/generate-windows` | Generate a season's transfer windows |
| POST | `/leagues/{id}/transfer-windows/{wid}/recalculate-score` | Recalculate one league window's scoring |
| POST | `/scoring/recalculate-active` | Recalculate every active window platform-wide *(super)* |
| POST | `/transfer-windows/{wid}/lock` | Force-set a window's lock flags |
| GET / PATCH | `/players/{id}` | Inspect / directly edit a player *(PATCH is super)* |
| POST | `/players/reprice` | Trigger a repricing pass |
| POST | `/leagues/{id}/trades/{tid}/veto`, `.../cancel` | Veto / force-cancel a trade regardless of league ownership |
| POST | `/leagues/{id}/waivers/{cid}/cancel` | Force-cancel a pending waiver claim |
| POST | `/transfers/{tid}/reverse` | Reverse a budget transfer as a compensating entry *(super)* |
| GET | `/leagues/{id}/transfer-windows`, `.../trades`, `.../waivers`, `.../transfers` | Per-league transaction listings |
| GET | `/jobs/celery`, `/jobs/kafka` | Worker/beat status, Kafka consumer liveness |
| GET / POST | `/config`, `/config/realtime-pipeline` *(super)*, `/config/live-polling` | List / toggle runtime feature flags (`system_config`) |
| GET / PATCH | `/tickets`, `/tickets/{id}` | List / triage support tickets (status, priority, assignment) |
| POST | `/tickets/{id}/messages` | Reply to a ticket, optionally as an internal note |

## Cross-cutting response conventions

- **Validation errors** — `422 Unprocessable Entity` with a body describing every
  failing field (FastAPI/Pydantic default), before any handler code runs.
- **Domain/business-rule errors** — `400` (bad input the schema alone couldn't
  catch), `403` (authenticated but not authorized for this resource), `404` (not
  found or not visible to this caller — the two are deliberately not distinguished
  in several league routes, so membership can't be probed by response shape), `409`
  (state conflict — wrong league status, window locked, already claimed, etc.).
- **Uncaught exceptions** — a global handler (`app/main.py`) logs the full
  traceback and returns a generic `500` with no internal detail leaked; a
  `ValueError` handler maps specifically to `400` (used by the ILP solvers'
  validation failures and several service-layer guards).
- **Rate-limited responses** — `429` with a `Retry-After` header, only on the auth
  endpoints listed above.
- Every response carries `X-RateLimit-*` headers (informational, even under the
  limit) and, on a GET that issued one, a fresh `X-CSRF-Token`.

## Explain Like I'm New

An API is just a menu of "things you're allowed to ask the backend to do," each with
its own rules about who's allowed to order it (auth), what you have to say correctly
to place the order (validation), and what happens if something's out of stock
(error codes). The 🔒/🔒+M/🔒+O/🔑 markers above are the "who's allowed at this
counter" rules for each menu item.

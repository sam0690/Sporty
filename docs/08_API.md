# 08 — API Reference

All backend REST endpoints, grouped by router, with method, path, auth requirement,
purpose, and the error codes that matter. Full request/response **schemas** live in
the FastAPI-generated OpenAPI docs (`/docs`, `/openapi.json` — auto-derived from the
Pydantic models in each slice's `schemas.py`, not duplicated here since they are
already machine-readable and always in sync with the code). This chapter is the
catalogue and the business rules a schema alone can't show.

**Auth key:** 🔓 = no auth. 🔒 = cookie-JWT (`get_current_active_user`). 🔒+M = 🔒 +
league membership (`require_league_member`). 🔒+O = 🔒 + league ownership
(`require_league_owner`). 🔑 = feeder shared-secret (`X-Feeder-Secret`), a distinct
trust boundary from user auth. All 🔒/🔒+M/🔒+O routes additionally require a valid
`X-CSRF-Token` header on non-GET verbs (see [10 — Security](10_SECURITY.md)).

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
| POST | `/{league_id}/leave` | 🔒+M | Leave a league (non-owner) | `403` owner cannot leave |
| POST | `/{league_id}/sports` | 🔒+O | Attach a sport | `409` league not in SETUP |
| DELETE | `/{league_id}/sports/{sport_name}` | 🔒+O | Detach a sport | — |
| POST | `/{league_id}/lineup-slots` | 🔒+O | Define position min/max per sport | — |
| GET | `/{league_id}/members` | 🔒+M | Membership list | — |
| POST | `/{league_id}/draft/start` | 🔒+O | Randomize draft order, create teams, → DRAFTING | `409` not SETUP / <2 members / no sport attached |
| POST | `/{league_id}/draft/pick` | 🔒+M | Make a snake-draft pick | `409` not caller's turn / player unavailable / squad full / budget exceeded |
| GET | `/{league_id}/draft/turn` | 🔒+M | Whose turn it is | — |
| POST | `/{league_id}/teams/build` | 🔒+M | Build a full squad directly (budget leagues) | `400` wrong player count / over budget |
| POST | `/{league_id}/auto-pick` | 🔒+M | PuLP ILP squad suggestion (does not persist) | `422` infeasible (see [06 — Algorithms](06_ALGORITHMS.md) §1) |
| DELETE | `/{league_id}/teams/players/{player_id}` | 🔒+M | Discard a player for a refund (with penalty) | `404` not owned |
| GET | `/{league_id}/my-team` | 🔒+M | Caller's squad + budget | — |
| POST | `/{league_id}/transfer-windows/generate` | 🔒+O | Create the season's weekly gameweeks | `409` not budget mode / not SETUP |
| POST | `/{league_id}/transfers` | 🔒+M | Single-shot transfer (see [06 — Algorithms](06_ALGORITHMS.md)/`make_transfer`) | `409` window locked / transfer cap reached / insufficient budget |
| GET | `/{league_id}/transfers` | 🔒+M | Transfer history | — |
| GET / PATCH / POST | `/{league_id}/my-team/lineup` | 🔒+M | Read/set the starting XI + captain/vice for the editable window (`PATCH` is canonical, `POST` a legacy alias) | `409` lineup window locked, `400` structural/position-slot violation, captain==vice |
| GET | `/{league_id}/my-team/gameweek-recap` | 🔒+M | Per-window scoring breakdown including auto-subs applied | — |
| GET | `/{league_id}/active-window` | 🔒+M | The window containing "now" | — |
| GET | `/{league_id}/editable-window` | 🔒+M | The next not-yet-locked window | — |
| GET | `/{league_id}/dashboard/stats` | 🔒+M | Summary stats for the league home page | — |
| GET | `/{league_id}/leaderboard` | 🔒+M | Standings (per-window or season-total; `historical` flag) | — |

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

## Players (`/api/v1/players`, `app/player/router.py`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `` | 🔒 | Paginated/filtered player list (sport, position, availability, search) |
| GET | `/stats` | 🔒 | Gameweek stats across players |
| GET | `/{player_id}` | 🔒 | Player detail |
| GET | `/{player_id}/stats/{gameweek_id}` | 🔒 | One player's stat line for one window |
| GET | `/{player_id}/price-history` | 🔒 | `PlayerPriceHistory` audit trail |

## Scoring config (`/api/v1/scoring/rules/*`, `/api/v1/leagues/{id}/scoring-overrides`)

| Method | Path | Auth | Purpose | Key errors |
|---|---|---|---|---|
| GET | `/scoring/rules/{sport_name}` | 🔒 | Platform default scoring rules | — |
| GET | `/leagues/{league_id}/scoring-overrides` | 🔒+M | This league's overrides | — |
| POST | `/leagues/{league_id}/scoring-overrides` | 🔒+O | Set/replace an override | `400` unknown action for the sport |
| DELETE | `/leagues/{league_id}/scoring-overrides/{override_id}` | 🔒+O | Remove an override (reverts to default) | — |

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
| DELETE | `/users/{user_id}` | 🔒 | Deactivate account (`204`) |
| GET | `/notifications` | 🔒 | Caller's notifications |
| PATCH | `/notifications/{id}/read` | 🔒 | Mark one notification read |

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

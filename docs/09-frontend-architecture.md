# 09 — Frontend Architecture

The frontend (`sporty-frontend/`) is a Next.js 16 App-Router SPA in TypeScript. Its guiding rule
(from `AGENTS.md`/`CLAUDE.md`) is a strict layering: **Backend → services → hooks (React Query) →
store/UI**. UI components never call Axios directly; business logic lives on the backend.

## Layers and folders

| Layer | Folder | Responsibility |
|-------|--------|----------------|
| Routing | `src/app/` | App Router route groups + layouts |
| API transport | `src/api/` | Two Axios instances + the endpoint registry |
| Services | `src/services/` | Typed API-call functions per domain |
| Hooks | `src/hooks/` | React Query wrappers + domain hooks |
| Store | `src/store/` | Zustand (live match state) |
| Cross-cutting | `src/lib/` | realtime client, socket, storage, validations, routing |
| Features | `src/features/` | Feature modules (create-team, my-team, transfers, …) composing components + hooks |
| Types | `src/types/` | TypeScript interfaces mirroring backend schemas |

Path alias `@/*` → `src/*`. Providers are wired in `src/app/client.tsx`:
`MantineProvider` → `QueryProvider` (React Query) → `AuthProvider`.

## The two Axios clients (`src/api/`)

Auth is **cookie-based**, so there's no token in JS — both clients set `withCredentials: true`.

- **`public-api-client.ts`** — for unauthenticated requests. Holds the **in-memory CSRF token**
  (`getCsrfToken`/`setCsrfToken` — never localStorage, for XSS safety). A response interceptor
  captures the `X-CSRF-Token` header from GET responses; a request interceptor attaches it to
  POST/PUT/PATCH/DELETE. Errors are normalized to `ApiError`.
- **`auth-api-client.ts`** — the authenticated instance. Same CSRF handling, plus a **401
  auto-refresh**: on a 401 it calls `refreshAccessToken()` once (a de-duped shared promise that
  `POST /auth/refresh`es), and retries the original request. If refresh fails it emits an
  `auth-invalidated` event (`src/lib/auth-events.ts`) that the auth context listens for to clear
  the user and redirect to login.

Every backend URL the app uses is registered centrally in **`src/api/apiPath.ts`** (`API_PATHS`,
grouped by domain: AUTH, USERS, LEAGUES, PLAYERS, SCORING, OPTIMIZATION, TRANSFERS, MATCHES). URLs
are never hard-coded in services — services consume these constants. When a backend route changes,
`API_PATHS` and the matching service are the two things to update.

## Services (`src/services/`)

One typed module per domain: `LeagueService`, `TeamService`, `PlayerService`, `ScoringService`,
`OptimizationService`, `UserService`, `MatchService`, `FeatureService`. Each is an object of async
functions that call `authApi`/`publicApi` with an `API_PATHS` constant and return typed data —
e.g. `LeagueService.getMyLeagues()`, `LeagueService.createLeague(payload)`,
`LeagueService.getMyTeam(id, signal)`. This is the **only** place Axios is called.

## Hooks (`src/hooks/`)

Two generic wrappers over TanStack Query:
- **`useApiQuery(queryKey, queryFn, options)`** (`hooks/api/useApiQuery.ts`) — thin `useQuery`
  wrapper that passes the `AbortSignal` through (so services can cancel in-flight requests).
- **`useApiMutation(mutationFn, options)`** (`hooks/api/useApiMutation.ts`) — `useMutation` wrapper
  that auto-fires success/error **toasts** (`src/lib/toastifier.ts`) unless `silent`.

Domain hooks (`hooks/leagues/useLeagues.ts`, `hooks/players/`, `hooks/scoring/`, `hooks/my-team/`,
`hooks/matches/`, `hooks/auth/`) build on those, wiring services to query keys and cache
invalidation. This is where React Query caching, refetching, and optimistic updates live —
components consume the hooks.

## State: auth context + Zustand

- **Auth** (`src/context/auth-context.tsx`) — a React context, not a store. On mount it
  **bootstraps the session** by calling `GET /auth/me` (works because the httpOnly cookie is sent
  automatically); success sets the `user`. It exposes `login`/`register`/`loginWithGoogle`/
  `linkGoogle`/`logout`/`forgotPassword`/`resetPassword`, each calling the appropriate service and
  refreshing `user` from `/auth/me`. It subscribes to the `auth-invalidated` event to clear the
  user and redirect protected routes to login. The Google-link 409 flow is handled here (stashing a
  one-time link token in sessionStorage). No token is ever stored client-side.
- **Live match** (`src/store/matchStore.ts`) — a Zustand store holding the live match snapshot:
  score, minute, players, event timeline, per-player points, lineups, socket status. It exposes
  `hydrate(snapshot)` (from the state endpoint) and reducers `applyScoreUpdate` / `applyPointsDelta`
  / `applyLineupChange` that the WebSocket handler dispatches. `mergeEvents` de-dupes incoming events
  by `event_id` and keeps the timeline sorted by minute.

Zustand is used only for genuinely-shared client state (the live match). Everything server-derived
stays in React Query.

## Realtime on the client (`src/lib/`, `src/hooks/`, `src/components/live/`)

This is the browser side of [08](08-live-match-pipeline.md):
- **`lib/realtimeApi.ts`** — `fetchMatchSnapshot(matchId)` (the authoritative
  `GET /api/match/{id}/state`), plus optional `fetchMatchPrediction` / `fetchMatchRatings` (404 =
  "feeder hasn't pushed it yet", treated as `null`). Crucially it hits the backend **origin
  directly** (deriving it from `NEXT_PUBLIC_API_URL` by stripping `/api/v1`), not the Next proxy,
  because the auth cookie lives on the backend domain.
- **`lib/socket.ts`** — `buildMatchSocketUrl(matchId)` derives a `ws(s)://…/api/ws/match/{id}` URL
  from the API base.
- **`hooks/useMatchSocket.ts`** — opens the WebSocket, dispatches each `WSMessage` to the matching
  `matchStore` reducer (`SCORE_UPDATE` → `applyScoreUpdate`, `FANTASY_POINTS_DELTA` →
  `applyPointsDelta`, `LINEUP_CHANGE` → `applyLineupChange`), and **auto-reconnects** after 2s on
  close.
- **`components/live/LiveMatchClient.tsx`** — the live match page. On mount it hydrates from the
  snapshot, opens the socket, and sets up a 15s **re-hydrate fallback** (self-heals if the socket
  drops) that stops once the match is `finished`. It renders phase-aware layouts (**pre** →
  prediction leads; **live** → event feed is the heartbeat; **post** → ratings/MOTM centrepiece),
  composed from `ScoreTicker`, `EventFeed`, `LiveLeaderboard`, `LineupsCard`, `PredictionCard`,
  `RatingsCard`, `ToastAlert`.

## Routing (`src/app/`)

App Router with route groups: `(auth)` (login/register/forgot/reset/google callback),
`(dashboard)` (the authed app: dashboard, leagues, my-team, transfers, create-team/league,
join-league, matches, profile, settings, and per-league `leagues/[id]/{lineup,roster,leaderboard,
members,invite,settings,create-team}`), `(public)`, and a top-level `match/[matchId]` (the live
match view). `next.config.ts` also defines `/league/:id* → /leagues/:id*` redirects.

## Dev cross-origin handling (`next.config.ts`)

In dev, `next.config.ts` **rewrites `/api/:path*` → `BACKEND_SERVER_URL`** (default
`http://localhost:8000`) so cookies are same-origin (avoids `SameSite=Lax` blocking cross-origin
POSTs). `NEXT_PUBLIC_API_URL` (e.g. `/api/v1`) is the base the Axios clients prepend. In production
the frontend and backend share a domain (or a reverse proxy), and cookies are `SameSite=None;
Secure`. ⚠️ Port note: the frontend proxy and `docker-compose` assume the backend on `:8000`;
run uvicorn on 8000 (or set `BACKEND_SERVER_URL`) for the proxy to work.

## A representative feature: create-team (`src/features/create-team/`)

`useCreateTeamDashboard` (the feature hook) shows the layering in action: it reads the league
(`useLeague`), the user's team (`useMyTeam`), and a filtered/paginated player pool (`usePlayers` +
`usePlayerFilters`); it wires the build/draft/discard mutations (`useBuildTeam`, `useMakeDraftPick`,
`useDiscardTeamPlayer`) and the draft turn (`useDraftTurn`); it validates the form with Zod
(`CreateTeamSchema`) via react-hook-form; and it branches on league mode (draft vs budget) and shape
(single vs multisport, with per-sport minimums `{football:8, basketball:7}` mirroring the backend).
The component (`CreateTeamView`) is presentation over that hook. This is the intended pattern for
every feature: a hook orchestrates services + React Query + Zod, and a view renders it.

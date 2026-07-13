# sporty-frontend — conventions

Next.js 16 (App Router) + React 19 + TypeScript (strict, no `any`) frontend
for the Sporty fantasy platform. It consumes the FastAPI backend over
`/api/v1` and implements no business logic of its own — the backend is the
source of truth for all rules and scoring.

## Stack (what is actually installed — check package.json before assuming)

- **Package manager: Yarn 4** (`corepack enable`; never npm)
- **UI**: Mantine 9 components + Tailwind CSS v4 for layout/spacing
- **Data**: Axios → TanStack React Query 5
- **State**: Zustand (used sparingly — one store, `src/store/matchStore.ts`)
- **Validation**: Zod 4 (`src/lib/validations.ts`)
- **Forms**: react-hook-form + @hookform/resolvers
- **Motion**: framer-motion · **DnD**: @dnd-kit · **Icons**: lucide-react

There is **no Redux** and no `tailwind.config.ts` — design tokens are
Tailwind v4 CSS-first, defined in `src/app/globals.css` with
`Design_System.md` as the source of truth. Never hardcode colors/spacing;
use the token classes (`bg-surface-1`, `text-fg-2`, `text-accent`, …).

## Commands

```bash
yarn dev      # dev server on :3000, proxies /api/* -> BACKEND_SERVER_URL (default :8000)
yarn build    # production build (CI runs this — keep it green)
yarn lint     # eslint
yarn tsc --noEmit   # typecheck
```

Full local stack (DB, Redis, API, workers): `docker compose up` at the repo root.

## Data flow — Backend → services → hooks → UI

1. **`src/api/apiPath.ts`** — every backend endpoint is registered in
   `API_PATHS`. Never hard-code a URL anywhere else. Adding/renaming a
   backend route means updating this registry and the matching service.
2. **`src/api/`** — the only two Axios instances: `auth-api-client.ts`
   (cookie auth, auto-refresh on 401, CSRF header) and
   `public-api-client.ts` (unauthenticated + in-memory CSRF token store).
   UI components never call Axios directly.
3. **`src/services/`** — typed functions per domain (`LeagueService`,
   `PlayerService`, …) consuming `API_PATHS`.
4. **`src/hooks/`** — React Query wrappers `hooks/api/useApiQuery.ts` /
   `useApiMutation.ts` (auto-toasts), plus domain hooks
   (`hooks/leagues/`, `hooks/players/`, …) that call services.
5. **`src/features/<feature>/`** — feature modules composing components +
   hooks. `src/components/ui/` holds the shared design-system primitives
   (Button, Card, Modal, EmptyState, ErrorState, skeletons, …) — reuse
   these before writing new ones.

Auth is **httpOnly-cookie JWT + CSRF double-submit**: tokens are never
readable from JS; state-changing requests carry `X-CSRF-Token` (handled by
the Axios interceptors — don't reimplement).

## Folder map

```
src/app/        App Router: (auth) (dashboard) (public) route groups, @modal
src/api/        Axios clients + API_PATHS registry
src/services/   API call functions per domain
src/hooks/      useApiQuery/useApiMutation + domain hooks
src/features/   feature modules (create-league, my-team, transfers, …)
src/components/ ui/ (design-system primitives), shared/, live/, dashboard/
src/store/      Zustand (matchStore)
src/context/    auth-context, react-query provider
src/lib/        realtime (socket.ts), routes, storage helpers, validations
src/types/      API response types
src/utils/      formatting/date/string helpers
```

Path alias: `@/*` → `src/*`.

## Rules

- Handle loading / error / empty states on every data-driven view
  (`EmptyState`, `ErrorState`, skeletons exist for this).
- Prefer editing an existing component over creating a near-duplicate.
- No new dependencies for what Mantine/Tailwind/stdlib already covers.
- Deployment is **Vercel** (frontend) + Render (API). There is no Docker
  image for the frontend and no Cloudflare/wrangler path.

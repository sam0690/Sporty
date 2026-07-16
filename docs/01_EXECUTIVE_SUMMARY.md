# 01 — Executive Summary

## What this project is

**Sporty** is a multi-sport fantasy sports platform covering **Football/Soccer**, **NBA
Basketball**, and **Cricket**. Users sign up, create or join a **league**, assemble a
**squad** of real players (either by **drafting** them one at a time against other
managers, or by **building** a team directly under a salary-cap **budget**), set a
weekly **starting lineup** (with a captain and vice-captain), and earn **fantasy
points** based on how those real players perform in real matches. Leagues can be
single-sport or **mixed** (e.g. football + basketball players inside one squad).

This is a monorepo of three cooperating codebases (two of which are documented here;
the third is a sibling repository):

| Repo | Path | Role |
|---|---|---|
| Backend | `Sporty_Backend/` | FastAPI REST API, background workers, the single source of truth (PostgreSQL) |
| Frontend | `sporty-frontend/` | Next.js 16 / React 19 web application |
| Data Feeder | `~/projects/SportyDataFeeder` (sibling repo, same machine, **not** part of this monorepo's git history) | A FastAPI service that **simulates** matches with trained statistical/ML models and pushes realistic play-by-play events into the backend, standing in for a paid live-sports-data provider |

## The problem this project solves

Fantasy sports platforms need two things that are each expensive on their own: (1) a
correct, fair, auditable game engine — squads, budgets, transfers, drafts, scoring
rules, leaderboards — and (2) a continuous supply of real-world match data to score
against. Sporty solves (1) in full (`Sporty_Backend/` + `sporty-frontend/`) and works
around (2) — which normally requires a paid data-feed subscription with rate limits —
by generating **statistically realistic** simulated matches (`SportyDataFeeder`) that
are pushed into the backend through the exact same ingestion path a real provider
would use. The backend also has fully-written, currently **disabled** code paths to
pull from real providers (API-Football, API-NBA) — flipping a single feature flag
(`LIVE_POLLING_ENABLED`) is the intended migration path, and nothing downstream of "a
match produced events" needs to change. **Could not determine from the current
codebase** whether that migration has been scheduled or budgeted — no such plan
exists in the repository.

## Main goals

- Let a group of users compete in a season-long fantasy competition with real
  scoring stakes (captain bonuses, transfer strategy, waiver claims, trades), in
  either classic cumulative-points leagues or opt-in **head-to-head** leagues
  (weekly one-vs-one matchups on a round-robin schedule, W-L-T standings).
- Support **three sports** with different rules (squad sizes, scoring formulas,
  stat shapes) behind one platform and one mixed-league concept.
- Make the live-match experience feel real-time: scores and fantasy points tick up
  during a match via WebSocket, not just after full-time.
- Do all of the above **without** a paid live-data subscription during development/demo,
  via the statistically-calibrated match simulator.
- Keep the system auditable: every points-affecting action (transfers, price changes,
  draft picks, trades) is written to an immutable history table.

## Who the users are

- **Fantasy managers** — the primary end user. Registers (picking a favourite team
  and player per sport during onboarding, which drives goal/score notifications),
  joins/creates leagues, drafts or buys players, sets lineups, makes transfers,
  claims free agents, proposes trades, watches live matches, checks the
  leaderboard, and can open support tickets.
- **League owners** — a fantasy manager with extra privileges scoped to a league they
  created: start the draft, generate transfer windows, override scoring rules, toggle
  mid-season joining, veto trades (commissioner power), delete the league.
- **Platform administrators** — a modeled role tier on `users.role`
  (`user`/`support`/`admin`/`super_admin`, enforced by `require_admin_role` in
  `app/admin/dependencies.py`). A dedicated `/api/v1/admin` router and a frontend
  admin console (`/admin` route group: users, leagues, seasons, scoring, players,
  transactions, jobs, config, tickets, audit log) cover user suspension/role
  changes, league/season overrides, scoring recalculation, repricing, feature
  flags, and support-ticket handling — every admin action is written to
  `admin_audit_logs`. Admins land on `/admin` (not the manager dashboard) after
  login. The feeder additionally has its own separate demo control panel
  (`SportyDataFeeder/app/static/admin.html`).
- **The Sporty Data Feeder** — a non-human, server-to-server actor. Authenticated by a
  shared secret (`X-Feeder-Secret`), it is trusted to create matches/players and push
  match events, but has no user-level access.

## High-level workflow (60-second version)

1. **Setup** — the platform seeds sports, seasons, players, and per-sport default
   scoring rules. A user creates a league (single- or mixed-sport) and either starts a
   **snake draft** or lets members **build**/**auto-pick** a squad under budget.
2. **Weekly cycle** — before each gameweek's transfer deadline, managers trade players
   (or, in draft leagues, claim free agents / negotiate trades with other managers);
   before the lineup deadline, they set their starting XI + captain/vice. Deadlines are
   auto-enforced by scheduled jobs.
3. **Matches happen** — the feeder (or, when enabled, a real sports-data API) produces
   per-player events minute by minute. The backend ingests them idempotently, streams
   live fantasy-point deltas to connected browsers, and — when the match finishes —
   folds the events into permanent per-player statistics.
4. **Scoring** — a background worker converts statistics into fantasy points using
   each league's effective scoring rules, applies formation-aware **auto-substitutions**
   for starters who didn't play, sums each team's starting XI with the captain-doubles
   rule, and computes SQL-`RANK()`-based standings.
5. **Leaderboards & pricing** — the league table reflects the new standings
   immediately; player prices drift over the season based on recent form and transfer
   demand.

See [03 — Request Flow](03_REQUEST_FLOW.md) for the mechanical trace of a single
request, and `docs/11-end-to-end-flows.md`-equivalent material folded into
[03](03_REQUEST_FLOW.md) for the full simulated-match-to-leaderboard trace.

## Technology at a glance

| Layer | Stack |
|---|---|
| Backend framework | FastAPI (Python), Uvicorn |
| Backend ORM / migrations | SQLAlchemy 2.0 (typed `Mapped[...]` models), Alembic |
| Database | PostgreSQL — sync driver `psycopg2` (most routes/jobs), async driver `asyncpg` (realtime only) |
| Cache / broker / pub-sub | Redis (sync `redis-py`, async `redis.asyncio`) — cache, distributed locks, transfer-session staging, Celery broker/result backend, WebSocket fan-out |
| Optimization | PuLP (integer linear programming) + the bundled CBC solver — squad auto-pick and lineup optimization |
| Background processing | APScheduler (in-process cron), Celery + Celery Beat (separate worker/beat processes), a dormant Kafka pipeline (`aiokafka`) gated by a feature flag |
| Auth | httpOnly-cookie JWT (`python-jose`) + CSRF double-submit + Google OAuth; passwords via `passlib`/bcrypt |
| Object storage | Cloudflare R2 (S3-compatible, via `boto3`) for avatars and team logos |
| Observability | `prometheus-fastapi-instrumentator` exposing `/metrics`; **no dashboard/alerting stack found in the repo** |
| Frontend framework | Next.js 16 (App Router), React 19, TypeScript |
| Frontend UI | Mantine (components) + Tailwind CSS (layout), `@dnd-kit` (drag-and-drop lineup builder) |
| Frontend data layer | Axios (two instances), TanStack Query (React Query), Zustand, Zod, react-hook-form |
| Package manager | Yarn 4 (frontend); pip + a plain `venv/` (backend, no `pyproject.toml`) |
| Feeder framework | FastAPI, SQLAlchemy, scikit-learn (`LogisticRegression` pipelines), NumPy/SciPy (Dixon-Coles bivariate Poisson, Elo), `httpx` |
| Containerization | Dockerfiles for both backend and frontend; the root `docker-compose.yml` runs the full local stack (postgres + redis + API + celery worker/beat + frontend) against a throwaway dev DB |
| Hosting (evidenced by code/config, not by an infra-as-code file) | Backend on Render, frontend on Vercel/Cloudflare, PostgreSQL on Render/Neon, Redis on Upstash — see [09 — Deployment](09_DEPLOYMENT.md) for exactly what is/isn't verifiable from the repo |

## Development methodology

The project's own `git log` (174 commits, 2026-03-07 → 2026-07-04) shows **continuous,
Kanban-style trunk-based development**, not Scrum or Waterfall: single active branch,
no sprint numbering or ticket references in commit messages, features shipped and
then revisited incrementally (scoring was touched in the first two weeks, then
substantially reworked months later for starter-only scoring and auto-substitution).
The one Waterfall-like exception is that larger features (e.g. the draft/waiver/trade
system) got a short written design doc
(`Sporty_Backend/docs/DRAFT_ROSTER_MANAGEMENT.md`) before implementation — a
lightweight "design-first for big features, continuous flow for everything else"
hybrid. See [`diagrams/01_development_methodology.md`](../diagrams/01_development_methodology.md)
for the actual commit-activity timeline.

## Explain Like I'm New

Think of Sporty as a "build your own dream team" game, like picking an all-star squad
of real football or basketball players and scoring points based on how they actually
play each week. Three separate programs make this work together: one is the website
you interact with (the **frontend**), one is the "brain" that remembers everyone's
teams and does the math (the **backend**), and one is a "pretend TV broadcast" that
invents realistic-looking matches (the **feeder**) so the game has something to score
against even without paying a real sports-data company. The pretend matches are
generated using real historical statistics and some light machine learning, so they
*feel* like real football/basketball, not random numbers.

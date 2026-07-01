# 01 — System Overview

## What Sporty is

Sporty is a fantasy sports platform. A user signs up, creates or joins a **league**,
builds a **squad** of real players under a budget, sets a weekly **lineup** (starting XI +
captain/vice-captain), and earns **fantasy points** based on how those real players
perform in real matches. Leagues can be single-sport (all football, all basketball) or
**mixed** (football + basketball players in one squad).

The twist that shapes the whole architecture: **there is no paid live sports-data feed in
use.** Real match performance is currently produced by a separate **simulator** repo
(SportyDataFeeder) that plays out matches with an ML model and pushes the results into the
backend over an authenticated HTTP endpoint. The backend also contains fully-written code
to poll real APIs (API-Football, API-NBA) instead, but it is gated off by default
(`LIVE_POLLING_ENABLED=False`, see `app/core/config.py`). Everything downstream of "a match
produced events" is identical whether the events came from the simulator or a real API.

## The three running processes

```
                 ┌─────────────────────────────────────────────────────────────┐
                 │                       SportyDataFeeder                       │
                 │  (sibling repo — FastAPI + ML match simulator)               │
                 │                                                              │
                 │  ML event-rate model ─┐                                      │
                 │  Elo/Dixon-Coles      │  minute-by-minute simulation loop    │
                 │  outcome model        │  (asyncio background task)           │
                 └───────────────────────┼──────────────────────────────────────┘
                                         │  HTTP push (X-Feeder-Secret)
                                         │  POST /api/v1/feed/match-result …
                                         ▼
   ┌──────────────────────────────────────────────────────────────────────────────┐
   │                              Sporty_Backend (FastAPI)                          │
   │                                                                                │
   │  REST /api/v1/*  ── auth, leagues, players, transfers, scoring, feed …         │
   │  Realtime /api/* ── WebSocket + SSE, reads Redis pub/sub                       │
   │                                                                                │
   │  Background:  APScheduler (in-process cron)                                    │
   │               Celery + Beat (scoring, pricing, auto-lock)                      │
   │               Kafka pipeline (dormant, REALTIME_PIPELINE_ENABLED=False)        │
   │                                                                                │
   │  Stores: PostgreSQL (source of truth) + Redis (cache, pub/sub, locks, session) │
   └───────────────────────────────────────────────┬────────────────────────────────┘
                                                    │  /api/v1 (cookie-JWT + CSRF)
                                                    │  /api WebSocket + SSE
                                                    ▼
                     ┌────────────────────────────────────────────────┐
                     │             sporty-frontend (Next.js)           │
                     │   Backend → services → React Query hooks →      │
                     │   Zustand store → UI (Mantine + Tailwind)       │
                     └────────────────────────────────────────────────┘
```

- **Backend** (`Sporty_Backend/app/main.py`) — a FastAPI app. All business REST is under
  `/api/v1`; realtime (WebSocket + SSE) is under `/api`. It owns the PostgreSQL database and
  talks to Redis. It also runs an in-process scheduler (APScheduler) in its lifespan, and is
  driven from outside by Celery workers + Celery Beat.
- **Frontend** (`sporty-frontend/`) — a Next.js App-Router SPA. It never holds a token in JS;
  it authenticates with httpOnly cookies and talks to `/api/v1` through two Axios instances.
- **Feeder** (`~/projects/SportyDataFeeder`) — a standalone FastAPI service that simulates
  matches and pushes results to the backend's `/api/v1/feed/*` endpoints. It is the current
  source of "live" data.

## Technology at a glance

**Backend:** FastAPI, SQLAlchemy 2.0 (typed `Mapped[...]` models), Alembic migrations,
PostgreSQL (psycopg2 sync + asyncpg async), Redis (redis-py sync + `redis.asyncio`),
Celery + Beat, APScheduler, PuLP (integer linear programming), passlib/bcrypt + python-jose
(JWT), Prometheus instrumentation. Optional/dormant: aiokafka + InfluxDB for a realtime
pipeline; tenacity + pybreaker for external-API resilience.

**Frontend:** Next.js 16 (App Router) + React 19 + TypeScript, Mantine (components) +
Tailwind (layout), Axios, TanStack Query (React Query), Zustand, Zod, react-hook-form,
@dnd-kit (lineup drag-and-drop). Package manager is Yarn 4. Deployed to Vercel/Cloudflare.

**Feeder:** FastAPI, SQLAlchemy, scikit-learn (LogisticRegression pipelines), NumPy/SciPy
(Dixon-Coles bivariate Poisson, Elo), httpx (push client). Its own PostgreSQL DB.

## The core mental model: gameweeks are "transfer windows"

Everything time-based in Sporty hangs off a **`TransferWindow`** (`app/league/models.py`).
A season (`Season`) is divided into numbered transfer windows. A window is effectively a
gameweek: it has a start/end, a **transfer deadline** (last moment to buy/sell players) and a
separate, later **lineup deadline** (last moment to change your starting XI). Scoring, pricing,
rankings, eligibility, and locking are all keyed on transfer windows. Keep this in mind — the
word "gameweek" in the UI is a `TransferWindow` row in the database.

## Top-level data flow (the 60-second version)

1. **Setup.** Platform seeds sports, seasons, players, and per-sport scoring rules. A user
   creates a league (single or mixed sport), attaches sports, and either **drafts** players
   (snake draft) or **builds** a squad directly under budget. Transfer windows are generated
   for the season.
2. **Weekly play.** Before the transfer deadline, users make transfers (swap players). Before
   the lineup deadline, they set their starting XI + captain/vice. A pair of Celery jobs
   auto-locks transfers and lineups when the deadlines pass.
3. **Matches happen.** The feeder (or a real API poller) produces per-player events for a
   match. On the finish transition, those events are folded into `PlayerGameweekStat` +
   sport-specific child tables (`FootballStat`/`NBAStat`/`CricketStat`), and a scoring job is
   enqueued.
4. **Scoring.** The scoring engine converts stats into per-player fantasy points using each
   league's effective scoring rules, aggregates a team's *starting-lineup* points (applying
   the captain/vice multiplier), writes a `TeamWeeklyScore`, and computes SQL `RANK()`
   standings.
5. **Live + leaderboards.** During a match, per-event fantasy deltas are streamed to the
   frontend over Redis pub/sub → WebSocket, so the live match page ticks up in real time.
   After scoring, the league leaderboard reflects the new standings.

The rest of these docs unpack each of those steps. See
[11 — End-to-End Flows](11-end-to-end-flows.md) for the fully-traced version.

## Repo-specific guides worth knowing about

Each repo carries its own `CLAUDE.md` with authoritative conventions:
- `Sporty_Backend/CLAUDE.md` — vertical-slice module layout, the two DB sessions, the
  transaction-ownership convention (services never `commit()`), the three background systems.
- `sporty-frontend/CLAUDE.md` + `AGENTS.md` — the Backend→services→state→UI layering rules.
- `SportyDataFeeder/CLAUDE.md` — the simulator's architecture and its many gotchas.

The visual architecture reference lives in this folder: [13 — System Architecture](13-system-architecture.md).
There are also older cross-cutting writeups at the monorepo root: `PROJECT_CONTEXT.md` and
`SYSTEM_DOCUMENTATION.md` (the previous root `SYSTEM_ARCHITECTURE.md` has been superseded by doc 13).

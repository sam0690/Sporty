# Sporty — System Documentation

This folder is a complete, code-grounded walkthrough of how Sporty works end to end.
Every claim here is traceable to a real file/function in the repositories; paths are
given so you can cross-check the source.

Sporty is a **multi-sport fantasy league platform** (Football/Soccer, NBA Basketball,
Cricket). It is a monorepo of two independently-deployed apps plus a sibling
**match simulator** repo that stands in for real sports data feeds:

| Component | Path | What it is |
|-----------|------|-----------|
| Backend | `Sporty_Backend/` | FastAPI API + Celery/APScheduler workers + realtime pub/sub + data ingestion |
| Frontend | `sporty-frontend/` | Next.js 16 (App Router) + React 19 + TypeScript UI |
| Data Feeder | `~/projects/SportyDataFeeder` (sibling repo) | FastAPI + ML match simulator that pushes "live" data into the backend |

## How to read this

Start at **01** for the big picture, then dive into whichever subsystem you care about.
The docs are ordered from "what is this" → data → features → runtime machinery → the simulator.

1. [System Overview](01-system-overview.md) — what Sporty is, the three processes, and the top-level data flow.
2. [Data Model](02-data-model.md) — the PostgreSQL schema: every table, relationship, and the reasoning behind the design.
3. [Auth & Security](03-auth-and-security.md) — cookie-JWT auth, CSRF double-submit, rate limiting, Google OAuth, middleware order.
4. [Leagues & Lifecycle](04-leagues-and-lifecycle.md) — creating leagues, the SETUP→DRAFTING→ACTIVE→COMPLETED lifecycle, the snake draft, transfer-window generation.
5. [Squads, Transfers & Optimization](05-squads-transfers-optimization.md) — building teams, the Redis-backed transfer staging session, and the two PuLP ILP solvers (auto-pick + lineup optimizer).
6. [Scoring, Ranking & Pricing](06-scoring-ranking-pricing.md) — the two scoring layers, the per-sport point formulas, captain/vice logic, SQL ranking, leaderboards, and dynamic repricing.
7. [Background Jobs](07-background-jobs.md) — the three background systems (APScheduler, Celery+Beat, Kafka), the task catalogue, and Redis distributed locks.
8. [Live Match Pipeline](08-live-match-pipeline.md) — how a live/simulated match flows in: feed ingestion, `feed_scoring`, Redis pub/sub, WebSocket/SSE, the (dormant) Kafka pipeline, and the (off-by-default) real-API pollers.
9. [Frontend Architecture](09-frontend-architecture.md) — Next.js layering, the two Axios clients, React Query, Zustand, the auth context, and the realtime live-match UI.
10. [Sporty Data Feeder](10-sporty-data-feeder.md) — the match simulator in full: its data model, ML models (event rates, Elo/Dixon-Coles outcome models), the minute-by-minute simulation algorithm, calibration, ratings, and the push/orchestration layer.
11. [End-to-End Flows](11-end-to-end-flows.md) — the whole system stitched together: user journeys and the complete "simulated match → fantasy points on the leaderboard" trace.
12. [Algorithms Index (detailed)](12-algorithms-index.md) — every non-trivial algorithm in the system explained in depth: what it does, **why** that approach was chosen, and **how** it works (with the math for ILP, snake draft, EWMA, calibration, Dixon-Coles, Elo, `RANK()`, pricing, Redis locks, and more). Includes a "where each algorithm fires" diagram.
13. [System Architecture (with diagrams)](13-system-architecture.md) — the visual top-down reference: component diagram, deployment topology, backend structure, request lifecycle, ER model, league state machine, the end-to-end live-match sequence, background-jobs map, frontend layering, and trust boundaries.

## Conventions in these docs

- **File references** look like `app/services/scoring/engine.py:score_transfer_window_for_league`.
  Unless prefixed with `sporty-frontend/` or the feeder path, backend paths are relative to `Sporty_Backend/`.
- Where something is **unclear or ambiguous in the code**, the docs say so explicitly rather than guessing.
- "Transfer window" and "gameweek" are used interchangeably — the code models a gameweek as a `TransferWindow` row.

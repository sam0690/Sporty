# 13 — System Architecture (with diagrams)

This is the top-down architecture reference: the components, how they're deployed, how a request
flows, how data moves, and the key lifecycles — all as diagrams with short explanations. It
complements [01 — System Overview](01-system-overview.md) (prose) by making the structure visual.

> Diagrams use [Mermaid](https://mermaid.js.org) (renders on GitHub and most Markdown viewers) plus
> ASCII where a quick sketch is clearer. Every box maps to a real path in the repos.

---

## 1. Component architecture (the whole platform)

Three deployable units. The **feeder** produces match data, the **backend** owns all state and
logic, the **frontend** is the UI. Redis and PostgreSQL are the shared infrastructure.

```mermaid
flowchart TB
    subgraph FE["sporty-frontend (Next.js 16 · Vercel)"]
        UI["React 19 UI<br/>Mantine + Tailwind"]
        SVC["services/ (Axios)"]
        RQ["React Query hooks"]
        ZS["Zustand matchStore"]
        UI --> RQ --> SVC
        UI --> ZS
    end

    subgraph BE["Sporty_Backend (FastAPI · Render)"]
        API["REST /api/v1/*"]
        RT["Realtime /api/*<br/>WebSocket + SSE"]
        FEED["Feed /api/v1/feed/*"]
        APS["APScheduler<br/>(in-process cron)"]
        subgraph WORKERS["Celery workers + Beat (run locally)"]
            CEL["scoring · pricing · auto-lock"]
        end
        KAFKA["Kafka pipeline<br/>(dormant)"]
    end

    subgraph FEED_SVC["SportyDataFeeder (FastAPI · simulator)"]
        SIM["simulation loop<br/>(asyncio)"]
        ML["ML models<br/>event_rates · Elo · Dixon-Coles"]
        PUSH["backend_client<br/>(httpx push)"]
        ML --> SIM --> PUSH
    end

    subgraph DATA["Shared infrastructure"]
        PG[("PostgreSQL<br/>source of truth")]
        REDIS[("Redis<br/>cache · pub/sub · locks · session · broker")]
    end

    SVC -- "cookie-JWT + CSRF<br/>/api/v1" --> API
    ZS -- "WebSocket /api/ws" --> RT
    SVC -- "GET /api/match/*/state" --> RT
    PUSH -- "X-Feeder-Secret<br/>POST /api/v1/feed/*" --> FEED

    API --> PG
    FEED --> PG
    CEL --> PG
    APS --> PG
    RT --> REDIS
    FEED --> REDIS
    CEL --> REDIS
    API --> REDIS
    FEED_SVC --> FDB[("Feeder PostgreSQL<br/>(its own DB)")]
```

**Key relationships:**
- The frontend talks to the backend **only** over `/api/v1` (cookie-JWT + CSRF) and the realtime
  `/api` (WebSocket/SSE). It never touches the DB or the feeder directly.
- The feeder talks to the backend **only** over `/api/v1/feed/*` (shared-secret), server-to-server.
- The backend owns the one true PostgreSQL; the feeder has its **own** separate DB.
- Redis is the connective tissue: cache, pub/sub fan-out, distributed locks, transfer sessions, and
  the Celery broker/result backend.

---

## 2. Deployment topology

Where each process runs and how it's wired.

```mermaid
flowchart LR
    Browser(["Browser"]) -->|HTTPS| Vercel["Vercel<br/>(Next.js SSR/SPA)"]
    Vercel -->|"/api/v1 · /api/ws<br/>(cookie-JWT)"| Render["Render<br/>FastAPI (uvicorn :8000)"]
    Render --> Neon[("Render PostgreSQL")]
    Render --> Upstash[("Upstash Redis<br/>rediss:// TLS")]

    LocalWorker["Local machine<br/>celery worker + beat"] --> Neon
    LocalWorker --> Upstash

    FeederHost["Feeder host<br/>uvicorn + asyncio sim"] -->|"POST /api/v1/feed/*"| Render
    FeederHost --> FeederDB[("Feeder PostgreSQL")]
```

**Notes grounded in the code/config:**
- The Celery **worker + Beat are run locally** against the same production PostgreSQL + Upstash Redis
  as the deployed API — a deliberate cost choice (avoids paying for extra Render worker instances).
  Because they share the DB/broker, they operate on live data.
- Upstash Redis is TLS (`rediss://`), which is why Celery's broker/backend URLs need
  `?ssl_cert_reqs=CERT_REQUIRED`, and why `task_ignore_result=True` is set (to avoid false TLS-timeout
  task failures). See [07 — Background Jobs](07-background-jobs.md).
- In dev, `next.config.ts` rewrites `/api/*` → `BACKEND_SERVER_URL` (default `:8000`) so cookies are
  same-origin. In prod the two share a domain / reverse proxy with `SameSite=None; Secure` cookies.

---

## 3. Backend internal structure (vertical slices)

The backend is organized as **vertical feature slices** — each owns its `models / router / services /
schemas` — plus shared cross-cutting layers.

```
Sporty_Backend/app/
├── main.py ................ wires routers + middleware + APScheduler lifespan
├── core/ ................. config, security (JWT), redis, redis_lock, celery_app, database (async)
├── database.py ........... sync engine + SessionLocal + get_db
├── middleware/ ........... security_headers → CORS → CSRF → rate_limiter  (outer → inner)
│
├── auth/ ................. users, refresh tokens, login/register/google/reset
├── league/ .............. THE big slice: leagues, draft, transfers, lineup, leaderboard,
│                          auto_pick_service (ILP), sportConfigs
├── player/ .............. players, price history, gameweek stats + sport child tables (+ models_nba)
├── match/ ............... Match fixtures
├── scoring/ ............. DefaultScoringRule / LeagueScoringOverride config + router
├── notification/, user/, optimization/ (ILP endpoint)
│
├── services/
│   ├── scoring/ ......... engine, player_scoring, team_scoring, ranking, rules, trigger, window_locator
│   ├── optimization/ .... ilp_optimizer (lineup)
│   ├── pricing/ ......... repricing (form-based)
│   ├── sync/ ............ real-API pollers (football/nba live, stats, match, player) — gated off
│   ├── feed_scoring.py .. bridges live events → deltas + persisted stats
│   ├── price_update_service.py, transfer_service.py, league_status_service.py, …
│
├── api/
│   ├── v1/feed.py ....... inbound feeder push endpoints
│   ├── v1/transfers.py .. staged transfer session
│   └── routes/ .......... realtime: websocket.py, sse.py, match.py (state snapshot)
│
├── tasks/ ............... Celery tasks + celery_schedule (Beat)
├── adapters/ ............ ISportAdapter per sport (used by dormant Kafka pipeline)
├── consumers/, workers/ . Kafka pipeline (dormant)
└── models/ ............. shared schemas (events) + db/live_event
```

**Two conventions that shape everything** (from `Sporty_Backend/CLAUDE.md`):
- **Services never `commit()`** — the router or job that called them owns the transaction.
- **All models are imported up-front** in `main.py` *and* `core/celery_app.py`, so SQLAlchemy resolves
  the string-named cross-module relationships before any query runs.

---

## 4. Middleware & request lifecycle

Every REST request passes through the middleware stack (outermost first), then a router → service →
DB. Realtime requests take a different path (Redis pub/sub).

```mermaid
flowchart TB
    req(["HTTP request"]) --> sh["1 · Security headers"]
    sh --> cors["2 · CORS (env origins)"]
    cors --> csrf["3 · CSRF double-submit<br/>(GET issues token · mutations validate)"]
    csrf --> rl["4 · Rate limiter (IP · auth endpoints)"]
    rl --> auth{"auth dependency<br/>get_current_active_user"}
    auth -->|cookie/Bearer JWT ok| router["Router (e.g. /leagues)"]
    auth -->|invalid| e401["401"]
    router --> svc["Service (business logic)"]
    svc --> db[("PostgreSQL")]
    router -->|owns txn| commit["db.commit()"]
    svc -. cache/session .-> redis[("Redis")]
    commit --> resp(["JSON response<br/>(+ X-CSRF-Token, rate headers)"])
```

- The frontend's Axios interceptors capture `X-CSRF-Token` from GET responses (in memory) and attach it
  to mutations; a 401 triggers a de-duped `/auth/refresh` + retry. See
  [03](03-auth-and-security.md) / [09](09-frontend-architecture.md).

---

## 5. Data model (entity-relationship overview)

The core relationships (simplified — see [02 — Data Model](02-data-model.md) for every column). Note how
**`TransferWindow` (the gameweek)** is the hub that scoring, lineups, transfers, and eligibility hang off.

```mermaid
erDiagram
    USER ||--o{ LEAGUE_MEMBERSHIP : joins
    USER ||--o{ FANTASY_TEAM : owns
    SPORT ||--o{ SEASON : has
    SEASON ||--o{ TRANSFER_WINDOW : "divided into"
    SEASON ||--o{ LEAGUE : hosts
    LEAGUE ||--o{ LEAGUE_SPORT : attaches
    LEAGUE ||--o{ LEAGUE_MEMBERSHIP : has
    LEAGUE ||--o{ FANTASY_TEAM : contains
    LEAGUE ||--o{ LINEUP_SLOT : "position rules"
    FANTASY_TEAM ||--o{ TEAM_PLAYER : roster
    FANTASY_TEAM ||--o{ TEAM_GAMEWEEK_LINEUP : "starting XI / window"
    FANTASY_TEAM ||--o{ TRANSFER : swaps
    FANTASY_TEAM ||--o{ TEAM_WEEKLY_SCORE : "points / window"
    SPORT ||--o{ PLAYER : catalogs
    PLAYER ||--o{ TEAM_PLAYER : "picked as"
    PLAYER ||--o{ PLAYER_GAMEWEEK_STAT : "stats / window"
    PLAYER_GAMEWEEK_STAT ||--o| FOOTBALL_STAT : "1:1 child"
    PLAYER_GAMEWEEK_STAT ||--o| NBA_STAT : "1:1 child"
    PLAYER_GAMEWEEK_STAT ||--o| CRICKET_STAT : "1:1 child"
    TRANSFER_WINDOW ||--o{ TEAM_GAMEWEEK_LINEUP : "scoped to"
    TRANSFER_WINDOW ||--o{ TEAM_WEEKLY_SCORE : "scoped to"
    TRANSFER_WINDOW ||--o{ PLAYER_GAMEWEEK_STAT : "scoped to"
    MATCH ||--o{ LIVE_EVENT : produces
    SPORT ||--o{ DEFAULT_SCORING_RULE : "default points"
    LEAGUE ||--o{ LEAGUE_SCORING_OVERRIDE : "override points"
```

The `PlayerGameweekStat` → `FootballStat`/`NBAStat`/`CricketStat` **table-per-subtype** pattern keeps the
base stat sport-agnostic while each sport's detail (and its NOT-NULL rules) lives in its own child table.

---

## 6. League lifecycle (state machine)

`League.status` moves forward only. Draft and budget leagues take different paths, driven partly by the
owner and partly by the daily lifecycle cron.

```mermaid
stateDiagram-v2
    [*] --> SETUP
    SETUP --> DRAFTING : owner starts draft (draft leagues, ≥2 members, ≥1 sport)
    DRAFTING --> ACTIVE : last draft pick auto-advances
    SETUP --> ACTIVE : budget league · start_date reached\n(daily cron, ≥ min members)
    ACTIVE --> COMPLETED : end_date passed (daily cron)
    COMPLETED --> [*]
    note right of SETUP
      Budget leagues skip DRAFTING.
      Draft leagues must pass through it.
    end note
```

See [04 — Leagues & Lifecycle](04-leagues-and-lifecycle.md).

---

## 7. The end-to-end live-match flow (sequence)

This is the platform's signature path: a simulated match becoming leaderboard points, streamed live.
(Full prose trace in [11 — End-to-End Flows](11-end-to-end-flows.md).)

```mermaid
sequenceDiagram
    autonumber
    participant F as Feeder (sim loop)
    participant BE as Backend feed API
    participant R as Redis
    participant W as Celery worker
    participant PG as PostgreSQL
    participant FE as Frontend (live page)

    F->>BE: POST /feed/schedule-match, /register|resolve-players
    BE->>PG: create Match + Player rows, links
    loop every simulated minute
        F->>BE: POST /feed/match-result (event batch)
        BE->>PG: upsert live_events (ON CONFLICT DO NOTHING)
        BE->>R: publish SCORE_UPDATE + FANTASY_POINTS_DELTA (match:{key})
        BE->>R: HINCRBYFLOAT fantasy:match:{key}:player:{id}
        R-->>FE: WebSocket push → matchStore ticks score/points
    end
    F->>BE: POST /feed/match-result (status=finished)
    BE->>PG: persist_match_stats → PlayerGameweekStat + child tables
    BE->>W: send_task score.transfer_window(window) (throttled)
    W->>PG: player_scoring UPDATE · team_weekly_scores · RANK()
    W->>R: invalidate leaderboard cache
    FE->>BE: GET /leagues/{id}/leaderboard → new standings
```

**Why the live number matches the final number:** the per-event live deltas
(`feed_scoring.apply_live_points`) use weights tuned to the batch engine's, so the ticking total
converges on the authoritative gameweek score computed at finish. See [08](08-live-match-pipeline.md).

---

## 8. Background processing (the three systems)

```
┌────────────────────┬───────────────────────────┬──────────────────────────────┐
│  APScheduler        │  Celery + Beat             │  Kafka pipeline (dormant)     │
│  (in FastAPI proc)  │  (separate processes)      │  REALTIME_PIPELINE_ENABLED    │
├────────────────────┼───────────────────────────┼──────────────────────────────┤
│ 00:00 lifecycle     │ every 10m score active     │ MatchScheduler → Ingestion*   │
│ 00:05 cache warm    │ every  5m auto-lock ×2      │ normalizer → points_engine    │
│ 02:00 ranking       │ 04:30    repricing         │ → notifications               │
│ 08:00 window notify │ on-finish score.window     │ (Redis pub/sub + InfluxDB)    │
│ every 4h pricing    │ (external sync: commented) │                               │
└────────────────────┴───────────────────────────┴──────────────────────────────┘
        │                        │                             │
        └──── all guarded by ────┴──── Redis distributed locks ┘  (SET NX EX + Lua release)
```

Scoring is produced from **three** idempotent places (on-finish, 10-min sweep, daily ranking) so a
failure in one path is caught by another. See [07 — Background Jobs](07-background-jobs.md).

---

## 9. Frontend data flow (layers)

```mermaid
flowchart LR
    subgraph Client
      C["Component<br/>(feature view)"] --> H["Domain hook<br/>(React Query)"]
      H --> S["Service<br/>(Axios + API_PATHS)"]
      C -->|live only| Z["Zustand matchStore"]
      WS["useMatchSocket<br/>(WebSocket)"] --> Z
    end
    S -->|"authApi / publicApi<br/>cookie-JWT + CSRF"| BE["Backend /api/v1"]
    WS -->|"/api/ws/match/{id}"| RT["Backend realtime"]
    RT --> REDIS[("Redis pub/sub")]
```

The rule (enforced by `AGENTS.md`): **Backend → services → hooks → store/UI**. Components never call
Axios directly; server-derived state lives in React Query; only genuinely-shared live state (the match)
lives in Zustand. See [09 — Frontend Architecture](09-frontend-architecture.md).

---

## 10. Trust boundaries (security view)

```
   Browser  ──cookie-JWT + CSRF──▶  Backend /api/v1        (user trust boundary)
   Browser  ──WebSocket (cookie)─▶  Backend /api/ws
   Feeder   ──X-Feeder-Secret────▶  Backend /api/v1/feed   (server-to-server boundary; no cookies/CSRF)
   Backend  ──DB creds───────────▶  PostgreSQL
   Backend  ──rediss:// TLS──────▶  Redis
   Frontend ── NEVER holds a token in JS (httpOnly cookies only)
```

Three distinct boundaries: **users** (cookie-JWT + CSRF + rate limits), the **feeder** (a shared secret,
CSRF-exempt because there's no browser session), and **infrastructure** (DB/Redis creds). See
[03 — Auth & Security](03-auth-and-security.md).

---

*For the "why/how" of the algorithms behind these flows, see [12 — Algorithms Index](12-algorithms-index.md).
For prose walkthroughs, see [01 — System Overview](01-system-overview.md) and [11 — End-to-End Flows](11-end-to-end-flows.md).*

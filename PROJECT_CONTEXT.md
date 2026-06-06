# PROJECT_CONTEXT.md — Sporty

> Living reference document for the Sporty codebase. Update this file when architectural decisions change or new modules are added.

---

## 1. Project Overview

**Sporty** is a multi-sport fantasy league platform. Users create or join private/public leagues, build fantasy squads from real players, and earn points based on real-world match performance.

Supported sports: **Football (Soccer)**, **Basketball (NBA)**, **Cricket**. Leagues can be single-sport or mixed (football + basketball in one squad).

Core value loop: create league → invite friends → draft/buy players with budget → set weekly lineup → score points from real matches → leaderboard ranking.

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  Browser / Client                                                    │
│  Next.js 16 (App Router) + React 19 + TypeScript                    │
│  Deployed: Vercel (https://sporty-woad.vercel.app)                  │
└───────────────────────────┬──────────────────────────────────────────┘
                            │ HTTPS / httpOnly cookies (JWT)
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│  FastAPI 0.129 (Python 3.14)                                        │
│  Sporty_Backend/app/main.py                                         │
│  Middleware stack: SecurityHeaders → CORS → CSRF → RateLimiter      │
│  All REST endpoints under /api/v1                                   │
│  WebSocket + SSE endpoints under /api                               │
└───┬───────────────────────┬────────────────────────────────────────┘
    │                       │
    ▼                       ▼
PostgreSQL              Redis (sync + async)
(SQLAlchemy 2.0         Cache / Rate limiting /
 asyncpg + psycopg2)    Session / Pub-Sub

    │ optional
    ▼
Kafka (aiokafka)        InfluxDB (time-series metrics)
Match event pipeline    (realtime match stats)
REALTIME_PIPELINE_ENABLED=False by default

    │ in-process
    ▼
APScheduler (BackgroundScheduler)
4 cron jobs — see §10 Dev Workflow

Celery (redis broker)   — wired up but separate process
```

---

## 3. Tech Stack

### Backend
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | FastAPI | 0.129.1 |
| ASGI server | Uvicorn + uvloop | 0.41.0 |
| ORM | SQLAlchemy | 2.0.46 |
| Async driver | asyncpg | 0.30.0 |
| Sync driver | psycopg2-binary | 2.9.11 |
| Migrations | Alembic | 1.18.4 |
| Validation | Pydantic v2 | 2.12.5 |
| Auth | python-jose + passlib/bcrypt | — |
| Task queue | Celery[redis] | — |
| Scheduler | APScheduler | 3.11.0 |
| Messaging | aiokafka | 0.12.0 |
| Time-series | influxdb-client | 1.49.0 |
| Optimiser | PuLP (ILP) | 2.9.0 |
| Email | Resend | 2.13.0 |
| Metrics | prometheus-fastapi-instrumentator | 7.1.0 |
| Push notifications | firebase-admin, APNS | — |
| Circuit breaker | pybreaker | 1.4.1 |

### Frontend
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.2.1 |
| Runtime | React | 19.2.4 |
| Language | TypeScript | ^5 |
| UI library | Mantine Core | ^9.0.1 |
| Styling | Tailwind CSS | ^4 |
| Server state | TanStack Query | ^5.95.2 |
| Client state | Zustand | ^5.0.8 |
| Forms | React Hook Form + Zod | ^7 / ^4 |
| HTTP | Axios | ^1.14.0 |
| DnD | @dnd-kit | ^6 |
| Deployment | Vercel + Cloudflare Workers (wrangler) | — |

---

## 4. Directory Structure

```
Sporty/
├── Sporty_Backend/              # Python FastAPI backend
│   ├── app/
│   │   ├── main.py              # App factory, middleware, router registration
│   │   ├── database.py          # SQLAlchemy engine & session
│   │   ├── core/
│   │   │   ├── config.py        # Settings (pydantic-settings, .env)
│   │   │   ├── celery_app.py    # Celery instance
│   │   │   ├── influx.py        # InfluxDB client
│   │   │   └── redis.py         # Sync + async Redis clients
│   │   ├── auth/                # JWT auth, Google OAuth, password reset
│   │   ├── league/              # League lifecycle, draft, transfers
│   │   ├── player/              # Player catalogue + sport-specific stats
│   │   ├── scoring/             # Scoring rules, models, service, router
│   │   ├── match/               # Match model
│   │   ├── notification/        # In-app notifications model + router
│   │   ├── optimization/        # ILP auto-pick endpoint
│   │   ├── user/                # User profile router
│   │   ├── squad/               # (placeholder — empty)
│   │   ├── adapters/            # ISportAdapter + Football/Cricket/Basketball impls
│   │   ├── consumers/           # Kafka consumers: normalizer, points_engine, notifications
│   │   ├── external_apis/       # RapidAPI wrappers: football, basketball, cricket, NBA
│   │   ├── ingestion/           # Player/team ingestion orchestrator + models
│   │   ├── middleware/          # CSRF, rate limiter, security headers
│   │   ├── models/
│   │   │   ├── db/live_event.py # Live event DB model
│   │   │   └── schemas/events.py# Pydantic event schemas (NormalizedEvent)
│   │   ├── services/
│   │   │   ├── scoring/         # engine, player_scoring, team_scoring, ranking, rules
│   │   │   ├── sync/            # Live data sync: football, basketball, cricket, NBA
│   │   │   ├── optimization/    # ilp_optimizer.py (PuLP)
│   │   │   ├── pricing/         # repricing.py (weighted points algo)
│   │   │   ├── budget_utils.py
│   │   │   ├── cache_warming_service.py
│   │   │   ├── email_service.py
│   │   │   ├── league_status_service.py
│   │   │   ├── match_scheduler.py
│   │   │   ├── notification_service.py
│   │   │   ├── price_update_service.py
│   │   │   ├── transfer_service.py
│   │   │   └── transfer_window_service.py
│   │   ├── api/
│   │   │   ├── v1/transfers.py  # Transfer REST endpoints
│   │   │   └── routes/          # WebSocket, SSE, match realtime routes
│   │   └── workers/             # Celery task definitions
│   ├── alembic/                 # DB migrations (17+ versions)
│   ├── tests/                   # pytest test suite
│   ├── scripts/                 # Utility scripts
│   ├── docs/monitoring/         # Monitoring docs
│   ├── Dockerfile
│   ├── alembic.ini
│   └── requirements.txt
├── sporty-frontend/             # Next.js frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/          # Login, register, forgot/reset password, Google callback
│   │   │   ├── (dashboard)/     # Protected dashboard pages
│   │   │   │   ├── leagues/[id]/ # League detail, leaderboard, roster, lineup, settings
│   │   │   │   ├── create-league/, join-league/, create-team/
│   │   │   │   ├── my-team/, transfers/, profile/, dashboard/
│   │   │   │   └── user/[id]/
│   │   │   ├── match/[matchId]/ # Live match view
│   │   │   └── (public)/        # Public pages
│   │   ├── api/                 # Axios client instances (auth + public)
│   │   ├── components/          # Feature-scoped UI components
│   │   ├── context/             # AuthContext, QueryContext
│   │   ├── domain/              # Domain types
│   │   ├── features/            # Feature modules (logic + view co-located)
│   │   ├── hooks/               # TanStack Query hooks per domain
│   │   ├── lib/                 # Utility libs
│   │   ├── services/            # Feature service layers
│   │   ├── store/               # Zustand stores (matchStore.ts)
│   │   ├── types/               # TypeScript type definitions
│   │   └── utils/               # Shared utilities
│   ├── public/images/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── package.json
├── EPL/                         # Premier League stats CSVs (data assets)
├── basketball/                  # NBA player stats CSV
├── merge_chunks.py              # Data utility script
└── graphify-out/                # graphify knowledge graph cache (auto-generated)
```

---

## 5. Data Models

All models use UUID primary keys and timezone-aware timestamps. Monetary values use `Numeric(precision, scale)` — never Float.

### Core Entity Hierarchy

```
Sport (football / basketball / cricket)
  └── Season (2025/26, date-bounded)
        └── TransferWindow (numbered, has transfer_deadline + lineup_deadline)

League (owned by User, linked to Season)
  ├── LeagueSport (M2M: League ↔ Sport, allows multi-sport leagues)
  ├── LineupSlot (per-league position rules: GKP min/max, DEF min/max, etc.)
  ├── LeagueMembership (User ↔ League, with draft_position + eligibility)
  └── FantasyTeam (one per user per league)
        ├── TeamPlayer (current + historical roster, cost snapshot)
        ├── Transfer (immutable audit log of each player swap)
        ├── BudgetTransaction (purchase / discard / transfer ledger)
        ├── TeamGameweekLineup (weekly starting XI + captain/vice-captain)
        ├── TeamWeeklyScore (denormalised points per window, rank_in_league)
        └── DraftPick (snake-draft history — append only)

Player (linked to Sport + optional RealTeam FK)
  ├── PlayerGameweekStat (base: minutes_played + fantasy_points)
  │     ├── FootballStat (1:1 child: goals, assists, clean_sheets, cards, etc.)
  │     ├── CricketStat  (1:1 child: batting/bowling/fielding stats, all nullable)
  │     └── NBAStat      (1:1 child: NBA-specific stats)
  └── PlayerPriceHistory (price change log with delta + algorithm_version)

User
  └── RefreshToken (SHA-256 hashed, not raw JWT stored)

Match, Notification, DefaultScoringRule, LeagueScoringOverride
IngestionPlayer, IngestionTeam (staging tables for external API data)
```

### League Lifecycle States
`SETUP → DRAFTING → ACTIVE → COMPLETED`
- Transitions driven by `league_status_service.py` + APScheduler daily job
- `allow_midseason_join=True` allows late joins on ACTIVE budget-mode leagues

### Key Invariants
- One FantasyTeam per user per league (`uq_team_league_user`)
- One active TeamPlayer per player per team (`uix_team_player_active` partial index)
- One captain/vice-captain per team per window (partial unique indexes)
- Player cannot be on the same team twice simultaneously (partial unique index on `released_window_id IS NULL`)
- Budget always non-negative (`ck_team_budget_non_negative`)
- `transfer_deadline_at < lineup_deadline_at <= end_at` (transfer window)

---

## 6. API Surface

All REST endpoints: `https://<host>/api/v1/...`

| Router | Prefix | Key Operations |
|--------|--------|----------------|
| `auth` | `/api/v1/auth` | Register, login, logout, refresh, Google OAuth, password reset, CSRF token |
| `league` | `/api/v1/leagues` | CRUD leagues, join/leave, start draft, make picks, set lineup, leaderboard |
| `player` | `/api/v1/players` | List/filter players, player stats, price history |
| `transfers` | `/api/v1/transfers` | Make transfers, view transfer history |
| `scoring` | `/api/v1/scoring` | Get scores, trigger scoring, scoring rules |
| `optimization` | `/api/v1/optimize` | ILP auto-pick endpoint (budget-constrained squad builder) |
| `notification` | `/api/v1/notifications` | List + mark-read notifications |
| `user` | `/api/v1/users` | User profile, avatar |
| `match` (realtime) | `/api/match` | Live match data |
| `websocket` | `/api/ws` | WebSocket live updates |
| `sse` | `/api/sse` | Server-Sent Events live updates |
| `health` | `/health` | Liveness probe (no auth, no DB) |
| `metrics` | `/metrics` | Prometheus scrape endpoint |
| `docs` | `/docs` | Swagger UI (OpenAPI 3.0.3) |

---

## 7. State Management

### Backend
- **Request-scoped DB sessions** via FastAPI `Depends` — session opened per request, closed on response.
- **Redis** for: rate-limit counters, cache warming (player lists), pub-sub for realtime events.
- **No shared mutable in-process state** except APScheduler jobs.
- Service functions do NOT call `db.commit()` — caller (router) owns the transaction boundary.

### Frontend
- **TanStack Query** — all server state (leagues, players, scores). Hooks in `src/hooks/`.
- **Zustand** — `matchStore.ts` for live match UI state (WebSocket-driven).
- **React Context** — `auth-context.tsx` (current user, login/logout), `Query-context.tsx` (QueryClient provider).
- **React Hook Form + Zod** — form validation (signup, create league, etc.).

---

## 8. Auth & Security

### Authentication Flow
1. User logs in → backend sets `access_token` + `refresh_token` as **httpOnly, Secure cookies**.
2. Access token: JWT (HS256), 90 min TTL. Refresh token: opaque random string, 7 days.
3. Refresh tokens stored as **SHA-256 hash only** — raw token never persisted.
4. Google OAuth: redirect flow, callback at `/auth/google/callback`.

### Security Layers (middleware order)
1. **SecurityHeaders** — CSP, HSTS, X-Frame-Options, X-Content-Type-Options
2. **CORS** — environment-driven origins; production: `https://sporty-woad.vercel.app` + Vercel preview subdomains
3. **CSRF** — double-submit cookie pattern (`X-CSRF-Token` header), exempt: `/health`, `/docs`, etc.
4. **RateLimiter** — IP-based Redis counters; global 120 RPM, login 10 RPM, register 5 RPM

### Auth Providers
- `LOCAL` — email + bcrypt password hash
- `GOOGLE` — Google OAuth with `google_id`
- DB-level `CHECK` constraint enforces provider-specific non-null fields

### Password Reset
- Token hash stored in `User.password_reset_token_hash` (SHA-256)
- Email sent via **Resend** API
- 30-minute expiry

---

## 9. Dev Workflow

### Running Locally

**Backend:**
```bash
cd Sporty_Backend
python -m uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd sporty-frontend
yarn dev   # runs on http://localhost:3000
```

**Environment:** Copy `Sporty_Backend/.env.example` → `.env`, fill in `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET_KEY`, `GOOGLE_CLIENT_ID`.

### Database Migrations
```bash
cd Sporty_Backend
alembic upgrade head          # apply all migrations
alembic revision --autogenerate -m "description"  # generate new
```

### Testing (Backend)
```bash
cd Sporty_Backend
pytest tests/
```
Test files cover: auto-pick, ILP optimizer, league lifecycle, player filters, scoring algorithms, realtime adapters, ingestion orchestrator, NBA ingest.

### Deployment
- **Frontend**: Vercel (auto-deploy on push) + optional Cloudflare Workers (`wrangler deploy`)
- **Backend**: Dockerfile in `Sporty_Backend/`; also `sporty-frontend/docker-compose.yml` for containerised dev

### Background Jobs (APScheduler, in-process)
| Job ID | Schedule | Purpose |
|--------|----------|---------|
| `daily_transfer_window_notifications` | Daily 08:00 UTC | Email users when transfer window opens |
| `daily_league_lifecycle` | Daily 00:00 UTC | Auto-advance league status (SETUP→ACTIVE, etc.) |
| `daily_cache_warming` | Daily 00:05 UTC | Pre-warm Redis player list cache |
| `price_update_every_4h` | Every 4 hours | Recalculate player prices (weighted points algo) |

---

## 10. Known Patterns & Conventions

### Backend
- **Domain modules** each have: `models.py`, `schemas.py`, `services.py`, `router.py`, `__init__.py`
- **Service layer owns business logic** — routers are thin HTTP adapters
- **Callers own transactions** — service functions never call `db.commit()`
- **String-based ORM relationships** to avoid circular imports across modules
- **Numeric(12,2) for money** — never float
- **UUID primary keys** everywhere
- **Soft-delete pattern** for sports (`is_active=False`) and memberships (`status=LEFT`)
- **Partial unique indexes** (PostgreSQL) for conditional uniqueness (active TeamPlayer, captain/vice-captain)
- **1:1 child table pattern** for sport-specific stats (`FootballStat`, `CricketStat`, `NBAStat` linked via `base_stat_id`)
- **Adapter pattern** (`ISportAdapter`) for normalising events from different sports APIs
- **Scoring rules** are a `dict[SportType, dict[EventType, RuleFunc]]` in `scoring/rules.py` — easy to extend per sport

### Frontend
- **Feature-scoped modules** in `src/features/` — each has components, hooks, and index barrel export
- **TanStack Query hooks** live in `src/hooks/<domain>/` — co-located with their data shape
- **Axios interceptors** handle token refresh and CSRF header injection
- Two API client instances: `auth-api-client.ts` (with credentials) and `public-api-client.ts`
- **App Router route groups**: `(auth)` for unauthenticated pages, `(dashboard)` for protected pages, `(public)` for marketing

### Sport Configuration
`sportConfigs.py` defines `SPORT_CONFIG_REGISTRY` with position minimums per sport per context (single-sport vs mixed). `derive_sport_type(sports)` returns `"football"`, `"basketball"`, or `"mixed"`.

---

## 11. Open TODOs / Technical Debt

| Area | Issue |
|------|-------|
| `app/squad/` | Module is empty — squad validation logic is distributed across league service |
| DB overlap prevention | `Season` and `TransferWindow` overlap checks are service-layer only — `btree_gist` ExcludeConstraints are TODO'd in the model comments |
| `rank_in_league` | `TeamWeeklyScore.rank_in_league` is set to NULL until a ranking job runs — the ranking job itself is not yet wired to a cron schedule |
| Realtime pipeline | `REALTIME_PIPELINE_ENABLED=False` by default; Kafka consumers exist (`normalizer.py`, `points_engine.py`) but the pipeline is not battle-tested in prod |
| CORS diagnostics middleware | `_cors_diagnostics_middleware` in `main.py` logs every request/response — should be removed before high-traffic production use |
| `real_team` column | `Player.real_team` is a String (v1 decision); normalised `real_team_id` FK exists but is nullable — migration to FK-only is TODO |
| OpenAPI 3.0.3 override | Custom `_custom_openapi()` to fix Swagger UI rendering; can be removed when Swagger UI supports OpenAPI 3.1 |
| SPORT_CONFIGS duplication | Two config dicts exist (`SPORT_CONFIGS` and `SPORT_CONFIG_REGISTRY`) in `sportConfigs.py` with overlapping purpose — consolidation needed |
| Cricket support | Cricket API integration exists but may be less tested than football/basketball paths |
| Test coverage | Tests are unit/integration style but no DB integration tests with testcontainers; note in model comments warns against SQLite for tests |

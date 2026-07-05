# 09 — Deployment

## What's actually in the repo vs. what's inferred

This chapter separates **evidenced-in-repo** facts (Dockerfiles, `docker-compose.yml`,
env var names, code comments naming a provider) from **inference** (nothing in this
monorepo is infrastructure-as-code — no Terraform, no Kubernetes manifests, no
`render.yaml`/`vercel.json`, no `.github/workflows`). Where the existing project
documentation (`docs/13-system-architecture.md`, now folded into
[02 — Architecture](02_ARCHITECTURE.md)) names specific providers (Render, Vercel,
Upstash, Neon), that naming is **taken from prior session's own account of the
deployment**, corroborated by code-level evidence (a `rediss://` TLS comment
referencing Upstash's connection quirks, a `?ssl_cert_reqs` note, `PORT` env var
defaults matching Render's convention) — but this chapter flags explicitly which
parts are directly verifiable in this repository and which are carried forward as
asserted context. **Could not determine** an authoritative source (an infra
dashboard, a `render.yaml`) inside this repository for the exact current hosting
plan/region/scaling configuration.

## Containerization

### Backend (`Sporty_Backend/Dockerfile`)

- Base image `python:3.11-slim` (the repo's own `CLAUDE.md` flags that local dev
  uses Python 3.14, but the **production image pins 3.11** — a real
  version-skew risk worth knowing before assuming a 3.14-only stdlib/syntax feature
  is safe to ship).
- Runs as a **non-root** user (`app`), created explicitly (`addgroup`/`adduser`) —
  a real, if small, security hardening step.
- `EXPOSE 10000`; the container's `CMD` binds `${PORT:-10000}` — deferring to
  whatever port the hosting platform injects via the `PORT` environment variable,
  falling back to 10000 for local/manual runs. (Note the mismatch with
  `Sporty_Backend/CLAUDE.md`'s dev command, which uses `--port 10000`, and the
  frontend proxy's default of `:8000` — see [02 — Architecture](02_ARCHITECTURE.md)
  and [14 — Improvements](14_IMPROVEMENTS.md) for the port-convention inconsistency
  this creates.)
- **Boot sequence** (`CMD`, a shell one-liner): `alembic upgrade head` runs as a
  **hard gate** — the container will not start Uvicorn if migrations fail. Then, in
  a subshell whose failure is deliberately swallowed (`|| echo '...continuing'`),
  idempotent baseline seeders run (`create_sports.py`, `seed_default_scoring_rules.py`)
  — a seeding hiccup is logged but never blocks the API from serving traffic, since
  these only upsert reference data. Finally `exec uvicorn app.main:app --host
  0.0.0.0 --port "${PORT:-10000}"` takes over the process (the `exec` matters: it
  replaces the shell so Uvicorn receives signals directly, letting the platform's
  graceful-shutdown `SIGTERM` reach the actual server process).

### Frontend (`sporty-frontend/Dockerfile`)

- Two-stage build: `node:20-alpine` builder runs `npm ci && npm run build`
  (note: **npm**, not Yarn, is used inside this specific Dockerfile, even though the
  project's package manager is Yarn 4 per `package.json`'s `packageManager` field —
  **could not determine** whether this Dockerfile is actually used in the current
  deployment path or is a legacy/alternate artifact, since Vercel deployments
  typically build directly from git rather than this Dockerfile). Production stage
  copies only `.next/standalone`, `.next/static`, and `public/` — Next.js's
  "standalone" output mode, which bundles a minimal `server.js` and only the
  production `node_modules` subset actually needed at runtime (much smaller image
  than a full `node_modules` copy).
- `sporty-frontend/docker-compose.yml` — a single-service compose file for running
  the frontend container locally: maps port 3000, sets `NEXT_PUBLIC_API_URL=/api/v1`
  and `BACKEND_SERVER_URL=http://localhost:8000`. **There is no docker-compose for
  the backend, Postgres, or Redis** — local backend development runs directly via
  `venv/bin/uvicorn` against whatever `DATABASE_URL`/`REDIS_URL` the developer's
  `.env` points at (a real external Postgres/Redis, not a local compose stack).

### The feeder (`SportyDataFeeder/Dockerfile`)

Exists in the sibling repo; **not inspected in depth for this chapter** since the
feeder is a separate deployable unit — see its own `CLAUDE.md`/`README.md` for
specifics if operating it directly.

## Inferred production topology

| Component | Where (per prior documented account + corroborating code evidence) |
|---|---|
| Frontend | Vercel or Cloudflare (the frontend `CLAUDE.md` mentions both `yarn deploy` → `wrangler deploy` for Cloudflare *and* a general "Deployed to Vercel/Cloudflare" note — **could not determine from this repo alone which is the actual current target**; `wrangler.toml`/Cloudflare Pages config would confirm this if present) |
| Backend | Render (uvicorn on a platform-injected `$PORT`, matching Render's convention) |
| Backend PostgreSQL | Render-managed Postgres or Neon (both named in prior docs; not independently re-verified here) |
| Redis | Upstash (`rediss://` TLS, Celery's `?ssl_cert_reqs=CERT_REQUIRED` requirement, and `task_ignore_result=True` specifically to dodge a documented Upstash TLS-timeout false-failure — see [06 — Algorithms](06_ALGORITHMS.md) §7a and [11 — Performance](11_PERFORMANCE.md)) |
| Celery worker + Beat | **Run locally** (a developer's machine), pointed at the same production Postgres + Upstash Redis as the deployed API — an explicit cost-avoidance choice (skips paying for a separate Render worker instance/dyno). This means **the worker/beat processes are not part of the platform's own uptime guarantees** — if the local machine is off, scoring/pricing/auto-lock stop running until it's back (mitigated by the layered redundancy described in [03 — Request Flow](03_REQUEST_FLOW.md) and [06 — Algorithms](06_ALGORITHMS.md) §10, but this is still a real single point of failure worth flagging — see [14 — Improvements](14_IMPROVEMENTS.md)). |
| Object storage | Cloudflare R2 (S3-compatible, confirmed directly in code — `app/services/storage_service.py`, `boto3`, `R2_*` env vars) |
| Feeder | A separate host running its own Uvicorn + the `asyncio` simulation loop, with its own separate PostgreSQL database |

## CI/CD

**No CI/CD pipeline exists in this repository.** There is no `.github/workflows/`
directory, no `.gitlab-ci.yml`, no `Jenkinsfile`, and no other CI configuration file
anywhere in the monorepo (verified by direct search). Tests
(`Sporty_Backend/tests/`, run via `pytest`) and linting (`yarn lint` on the
frontend) exist and are documented as commands in each app's `CLAUDE.md`, but
**nothing in the repository runs them automatically** on push/PR. Deployment appears
to be push-to-deploy (Render/Vercel-style auto-deploy on a git push to the tracked
branch) rather than a gated pipeline. See [14 — Improvements](14_IMPROVEMENTS.md).

## Environment variables (backend, `Sporty_Backend/.env.example`)

| Variable | Purpose | What breaks if missing/misconfigured |
|---|---|---|
| `ENVIRONMENT` | `development`/`staging`/`production` — gates `settings.validate_production()`'s stricter checks | Wrong value can either skip needed production hardening checks or wrongly enforce them in dev |
| `DATABASE_URL` | Sync PostgreSQL connection string | **Required at startup** — the app cannot boot without it |
| `REDIS_URL` | Cache/pub-sub/session/lock Redis | **Required at startup**; CSRF and rate-limiting still function in fail-open mode if Redis becomes unreachable *after* boot, but a missing `REDIS_URL` at boot is fatal |
| `CELERY_BROKER_URL` / `CELERY_RESULT_BACKEND` | Celery's queue + result store | Worker/beat processes can't start; scoring/pricing/auto-lock jobs never run (the on-finish scoring path in the API process still enqueues, but nothing consumes the queue) |
| `JWT_SECRET_KEY` | Signs access + password-reset JWTs | **Required, ≥32 chars** — the app refuses to boot with a short/missing key (`validate_production`) |
| `JWT_ALGORITHM` | Signing algorithm (`HS256`) | Changing this without a coordinated key rotation invalidates all existing tokens |
| `ACCESS_TOKEN_EXPIRE_MINUTES` / `REFRESH_TOKEN_EXPIRE_DAYS` | Token lifetimes | Too short = frequent forced re-auth (mitigated by the auto-refresh flow); too long = a stolen token stays valid longer |
| `GOOGLE_CLIENT_ID` | Verifies Google OAuth ID tokens | **Required at startup** per `Sporty_Backend/CLAUDE.md`; Google sign-in fails without it |
| `CORS_PRODUCTION_ORIGINS` / `CORS_STAGING_ORIGINS` / `CORS_LOCAL_ORIGINS` | Allowed cross-origin callers | Wrong/missing origin → the browser blocks all cross-origin requests from the frontend (CORS preflight failure), even though the API itself would have accepted the request |
| `COOKIE_SECURE` / `COOKIE_SAME_SITE` / `COOKIE_DOMAIN` | Auth cookie attributes | `SameSite=None` **without** `Secure=True` is rejected outright by `validate_production()` at boot (browsers reject that combination anyway) |
| `RATE_LIMIT_*` | Enable/tune sliding-window limits per auth endpoint | Set too low, legitimate users get `429`s; the limiter itself fails open if Redis is down, so these settings don't affect availability during a Redis outage |
| `CSRF_ENABLED`, `CSRF_COOKIE_NAME`, `CSRF_HEADER_NAME`, `CSRF_EXEMPT_PATHS` | CSRF middleware configuration | Disabling in production removes a real protection against forged cross-site state-changing requests |
| `RAPIDAPI_FOOTBALL_KEY` / `RAPIDAPI_NBA_KEY` / `CRICKET_API_KEY` / `BALLDONTLIE_API_KEY` | Real-provider API keys for the currently-disabled sync/live-polling paths | No effect while `LIVE_POLLING_ENABLED=False`; needed only if that flag is flipped on |
| `RESEND_API_KEY` / `FROM_EMAIL` | Transactional email (password reset, notifications) | Password-reset emails silently fail to send without a valid key |
| `FRONTEND_BASE_URL` | Base URL embedded in password-reset links | Wrong value sends users to a broken reset link |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` / `R2_PUBLIC_URL_BASE` | Cloudflare R2 object storage for avatars/team logos | Left blank, `storage_service.r2_is_configured()` returns false and avatar/logo upload endpoints return `503` — the rest of the app is otherwise unaffected |
| `FIREBASE_CREDENTIALS_PATH`, `APNS_*` | Push notifications (Firebase Cloud Messaging / Apple Push) | **Could not determine** current activation status beyond the env var scaffold and `firebase-admin` dependency; no push-sending call site was inspected for this chapter |
| `REALTIME_PIPELINE_ENABLED` | Master switch for the Kafka realtime pipeline | `False` (default) → the entire Kafka/adapter/consumer stack never starts; the feeder+Redis+WebSocket path is used instead |
| `LIVE_POLLING_ENABLED` | Master switch for real-API (API-Football/API-NBA) live pollers | `False` (default) → `sync_football_live_matches`/`sync_nba_live_matches` are no-ops; the feeder remains the only live-data source |
| `KAFKA_BOOTSTRAP_SERVERS`, `INFLUXDB_*` | Dormant Kafka pipeline's broker + time-series store | Irrelevant while `REALTIME_PIPELINE_ENABLED=False` |
| `FEEDER_SECRET` | Shared secret authenticating the feeder's server-to-server pushes | Empty → **every** `/api/v1/feed/*` route returns `503` (the endpoint is deliberately disabled rather than accepting unauthenticated pushes) |

## Health checks & observability

- `prometheus-fastapi-instrumentator` exposes `/metrics` (Prometheus exposition
  format) — **confirmed in code** (`app/main.py:412`). **Could not determine** from
  this repository whether anything actually scrapes this endpoint (no Prometheus
  server config, no Grafana dashboard definitions, no alerting rules checked in) —
  the metrics endpoint exists, but the rest of an observability stack around it is
  not evidenced here.
- **Could not determine** the existence of a dedicated `/health` endpoint on the
  Sporty backend from the routers inspected for this chapter (the feeder does have
  one, per [04 — Models](04_MODELS.md)/[05 — Simulation Engine](05_SIMULATION_ENGINE.md)
  context); if the hosting platform relies on one for readiness checks, its
  definition was not located during this pass.

## Scaling

**Could not determine** any horizontal-scaling configuration (replica counts,
autoscaling rules) from the repository — these would live in the hosting platform's
own dashboard/config, not in this codebase. Structurally, the API process is
stateless enough to scale horizontally (all session/lock state lives in Redis, not
in-process, **except** the feeder's `_simulations` registry and the backend's
in-process APScheduler jobs — running multiple API instances would each run their
own APScheduler schedule, meaning cron jobs like the daily lifecycle transition or
gameweek ranking could fire once per instance unless additionally lock-guarded; the
Redis distributed lock (`app/core/redis_lock.py`) is used for the Celery/worker-side
jobs and the waiver/trade scheduler jobs, but **could not confirm** the in-process
APScheduler jobs in `app/main.py`'s lifespan are similarly lock-guarded against
multi-instance duplication — flagged in [14 — Improvements](14_IMPROVEMENTS.md)).

## Explain Like I'm New

Deploying this app is like three separate moving trucks (frontend, backend, feeder)
each driving to their own destination, plus one extra worker who does background
chores (the Celery worker) but — interestingly — that worker currently works from
home (a developer's own machine) rather than from the same office building as
everyone else, purely to save on rent. There's no automatic inspector (CI/CD)
checking the trucks before they leave; whoever pushes the "go" button (git push) is
trusting that things work.

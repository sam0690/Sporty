# Sporty

Multi-sport fantasy league platform (Football, NBA Basketball, Cricket).
Create or join leagues, build squads under a budget or via live drafts, set
weekly lineups, and score points from real match performance — including
mixed-sport leagues (football + basketball in one squad).

Monorepo:

| Path | What | Deployed on |
|---|---|---|
| `Sporty_Backend/` | FastAPI API + Celery workers + data ingestion | Render (Docker) |
| `sporty-frontend/` | Next.js 16 / React 19 / TypeScript UI | Vercel |
| `EPL/`, `basketball/` | Raw stat datasets consumed by the seeders | — |
| `docs/`, `diagrams/` | Architecture writeups & diagrams | — |

## Run it

```bash
docker compose up
# frontend  → http://localhost:3000
# API       → http://localhost:8000  (docs at /docs, health at /health)
```

The compose stack is self-contained (own Postgres + Redis, dev-only
credentials, auto-migrated and seeded with sports + scoring rules). Optional
player data: `docker compose exec backend python scripts/import_datasets.py`.

Running pieces natively instead: see `Sporty_Backend/CLAUDE.md` (venv,
uvicorn on :8000, Celery) and `sporty-frontend/AGENTS.md` (Yarn 4).

## Test

```bash
cd Sporty_Backend && venv/bin/pip install -r requirements-dev.txt && venv/bin/python -m pytest
cd sporty-frontend && yarn lint && yarn tsc --noEmit && yarn build
```

CI runs both on every push (`.github/workflows/`).

## Deploy

- **Backend** — Render builds `Sporty_Backend/Dockerfile`; the container runs
  `alembic upgrade head` + idempotent seeders on boot. Required env is listed
  in `Sporty_Backend/.env.example`; production must set
  `ENVIRONMENT=production`, `COOKIE_SECURE=true`, and either
  `COOKIE_SAME_SITE=lax` + `COOKIE_DOMAIN=.sportyyy.tech` (app and API on
  sibling subdomains — the current setup) or `COOKIE_SAME_SITE=none` for
  unrelated domains (boot fails fast otherwise).
- **Frontend** — Vercel builds `sporty-frontend/` from source
  (`NEXT_PUBLIC_API_URL` + `BACKEND_SERVER_URL` env).

For architecture context start with `CLAUDE.md` (root),
`Sporty_Backend/CLAUDE.md`, and `PHASE1_AUDIT.md`.

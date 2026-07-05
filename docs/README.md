# Sporty — Technical Documentation

This is the complete, code-grounded technical documentation for Sporty: a
multi-sport fantasy league platform built from two independently-deployed apps
(`Sporty_Backend/`, `sporty-frontend/`) plus a sibling match-simulator repository
(`SportyDataFeeder`). It is written for a new senior developer joining the project
with no prior context, and is intended to be complete enough to maintain, extend,
debug, or rebuild the system from these files alone.

**Every claim in this documentation is grounded in the actual code** — file and
function names are cited throughout so you can cross-check anything. Where the
codebase didn't provide enough evidence to state something as fact, the relevant
chapter says so explicitly ("Could not determine from the current codebase") rather
than guessing.

Diagrams (Mermaid/PlantUML) live in the sibling [`/diagrams`](../diagrams/README.md)
folder, one file per diagram, kept separate from prose per this documentation set's
format — each chapter links to the diagrams relevant to it.

## Reading order

1. [Executive Summary](01_EXECUTIVE_SUMMARY.md) — what Sporty is, the problem it
   solves, its users, and the technology stack at a glance.
2. [Architecture](02_ARCHITECTURE.md) — the three deployable units, backend/frontend
   internal structure, databases, caching, message brokers, external providers.
3. [Request Flow](03_REQUEST_FLOW.md) — exactly what happens for a standard
   authenticated request and for the "match finishes → leaderboard updates" flow
   that exercises validation, business logic, the database, and background workers.
4. [Models](04_MODELS.md) — every statistical/ML model in the system (all in the
   `SportyDataFeeder` sibling repo): EWMA form, team strength, the v1 logistic
   outcome model, the Elo+logistic v2/v4/v5 production outcome models, the
   Dixon-Coles goal model, and rule-based post-match ratings.
5. [Simulation Engine](05_SIMULATION_ENGINE.md) — a complete mechanical deep dive
   into the feeder's minute-by-minute match simulator: initialization, event
   sampling, calibration, substitutions, discipline, overtime, and what's
   deliberately *not* modeled (injuries, penalties, possession).
6. [Algorithms](06_ALGORITHMS.md) — every non-trivial algorithm in the system with
   complexity analysis: the two ILP solvers, the snake draft, scoring/auto-subs/
   captain-vice/ranking, pricing, waivers/trades, live ingestion, concurrency
   primitives, and resilience patterns.
7. [Database](07_DATABASE.md) — the full PostgreSQL schema, relationships,
   constraints, and migration history, including the newest draft-roster/waiver/
   trade tables.
8. [API](08_API.md) — every REST/WebSocket/SSE endpoint, grouped by domain, with
   auth requirements and key error codes.
9. [Deployment](09_DEPLOYMENT.md) — Docker, the inferred hosting topology, every
   environment variable, and what CI/CD does and doesn't exist.
10. [Security](10_SECURITY.md) — auth, CSRF, CORS, rate limiting, and an OWASP
    Top 10 walkthrough of how (or whether) each risk is addressed.
11. [Performance](11_PERFORMANCE.md) — caching, batching, connection pooling, and
    other concrete performance decisions found in the code.
12. [Code Walkthrough](12_CODE_WALKTHROUGH.md) — a directory-by-directory map of
    the codebase with pointers into the chapters above.
13. [Glossary](13_GLOSSARY.md) — every abbreviation used across this documentation,
    spelled out.
14. [Improvements](14_IMPROVEMENTS.md) — concrete, code-grounded suggestions across
    architecture, performance, security, modeling, and code quality.

## Conventions

- **File references** look like `app/services/scoring/engine.py:score_transfer_window_for_league`.
  Unless prefixed with `sporty-frontend/` or naming the feeder explicitly, backend
  paths are relative to `Sporty_Backend/`.
- **"Gameweek" and "transfer window"** are used interchangeably — the database
  models a gameweek as a `TransferWindow` row.
- **"Could not determine from the current codebase"** appears wherever a claim
  couldn't be verified against the actual repository — treat these as open
  questions for the team, not gaps to be silently filled in.
- Each chapter ends with an **"Explain Like I'm New"** section — a plain-language
  analogy for the material just covered, for readers newer to this specific domain
  or to software architecture generally.

## Where the diagrams are

| Diagram | File |
|---|---|
| Development methodology | [`diagrams/01_development_methodology.md`](../diagrams/01_development_methodology.md) |
| Use case diagram | [`diagrams/02_use_case_diagram.md`](../diagrams/02_use_case_diagram.md) |
| Gantt chart | [`diagrams/03_gantt_chart.md`](../diagrams/03_gantt_chart.md) |
| Class diagram | [`diagrams/04_class_diagram.md`](../diagrams/04_class_diagram.md) |
| Object diagram | [`diagrams/05_object_diagram.md`](../diagrams/05_object_diagram.md) |
| Sequence diagram | [`diagrams/06_sequence_diagram.md`](../diagrams/06_sequence_diagram.md) |
| State diagram | [`diagrams/07_state_diagram.md`](../diagrams/07_state_diagram.md) |
| Activity diagram | [`diagrams/08_activity_diagram.md`](../diagrams/08_activity_diagram.md) |
| Refined class diagram | [`diagrams/09_refined_class_diagram.md`](../diagrams/09_refined_class_diagram.md) |
| Refined sequence diagram | [`diagrams/10_refined_sequence_diagram.md`](../diagrams/10_refined_sequence_diagram.md) |
| Component diagram | [`diagrams/11_component_diagram.md`](../diagrams/11_component_diagram.md) |
| Deployment diagram | [`diagrams/12_deployment_diagram.md`](../diagrams/12_deployment_diagram.md) |

## Related documentation elsewhere in the monorepo

- `Sporty_Backend/CLAUDE.md`, `sporty-frontend/CLAUDE.md` + `AGENTS.md` — living,
  authoritative developer-convention guides maintained alongside the code itself;
  read them before making changes in either app.
- `Sporty_Backend/docs/DRAFT_ROSTER_MANAGEMENT.md` — the original design doc for
  the waiver/trade system covered in this documentation's [06](06_ALGORITHMS.md)
  and [07](07_DATABASE.md) chapters.
- `~/projects/SportyDataFeeder/CLAUDE.md`, `PRD.md`, `reports/` — the feeder's own
  architecture notes and model-training research reports, referenced (not
  reproduced in full) in [04 — Models](04_MODELS.md) and
  [05 — Simulation Engine](05_SIMULATION_ENGINE.md).

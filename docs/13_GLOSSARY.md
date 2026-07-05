# 13 — Glossary

Every abbreviation and specialized term used across this documentation set, spelled
out in full. Terms are grouped by theme; within a group, alphabetical.

## General software / web

- **API** — Application Programming Interface.
- **REST** — Representational State Transfer (the HTTP API style Sporty uses).
- **HTTP / HTTPS** — HyperText Transfer Protocol (/ Secure).
- **URL** — Uniform Resource Locator.
- **JSON** — JavaScript Object Notation.
- **JSONB** — PostgreSQL's binary-storage JSON column type (indexable, generally
  faster to query than plain `JSON`).
- **SPA** — Single-Page Application.
- **SSR** — Server-Side Rendering.
- **UI / UX** — User Interface / User Experience.
- **DTO** — Data Transfer Object (in this codebase, Pydantic schemas and TypeScript
  `types/` interfaces serve this role).
- **CLI** — Command-Line Interface.
- **CDN** — Content Delivery Network.
- **CI/CD** — Continuous Integration / Continuous Deployment.
- **SDK** — Software Development Kit.

## Backend / data

- **ORM** — Object-Relational Mapper (SQLAlchemy, mapping Python classes to
  database tables).
- **SQL** — Structured Query Language.
- **DB** — Database.
- **PK / FK** — Primary Key / Foreign Key.
- **UUID** — Universally Unique Identifier (the primary-key type used for almost
  every Sporty backend table).
- **DDL** — Data Definition Language (schema-defining SQL, e.g. `CREATE TABLE`).
- **CRUD** — Create, Read, Update, Delete.
- **TTL** — Time To Live (an expiration duration, used throughout for Redis keys).
- **NX / EX** — Redis `SET` option flags: `NX` = only set if the key does **N**ot
  e**X**ist; `EX` = set an expiration in seconds.
- **GiST** — Generalized Search Tree, a PostgreSQL index type used here for the
  `ExcludeConstraint`s that prevent overlapping date/time ranges.
- **MVCC** — Multi-Version Concurrency Control (PostgreSQL's underlying
  transaction-isolation mechanism; referenced conceptually, not directly discussed
  in code).
- **ACID** — Atomicity, Consistency, Isolation, Durability (the transactional
  guarantees the backend relies on when a router commits a unit of work).

## Auth / security

- **JWT** — JSON Web Token.
- **OAuth** — Open Authorization (the protocol family behind "Sign in with
  Google").
- **CSRF** — Cross-Site Request Forgery.
- **XSS** — Cross-Site Scripting.
- **CORS** — Cross-Origin Resource Sharing.
- **CSP** — Content Security Policy.
- **HSTS** — HTTP Strict Transport Security.
- **SQLi** — SQL Injection.
- **XXE** — XML External Entity (an injection attack class; not applicable to this
  JSON-based system).
- **TLS** — Transport Layer Security (the encryption protocol behind `https://`
  and `rediss://`).
- **HS256** — HMAC using SHA-256, the JWT signing algorithm used here.
- **PII** — Personally Identifiable Information.
- **OWASP** — Open Web Application Security Project (source of the "Top 10" risk
  list referenced in [10 — Security](10_SECURITY.md)).

## Optimization / algorithms

- **ILP** — Integer Linear Programming.
- **NP-hard** — a complexity class of problems believed to have no known
  polynomial-time solving algorithm in the worst case (the theoretical category ILP
  belongs to).
- **CBC** — Coin-or Branch and Cut, the open-source ILP solver bundled with PuLP.

## Machine learning / statistics (feeder)

- **ML** — Machine Learning.
- **Elo** — the Elo rating system (not an acronym; named after its creator, Arpad
  Elo).
- **EWMA** — Exponentially Weighted Moving Average.
- **MOV** — Margin Of Victory (an Elo rating-update variant weighted by how
  lopsided a result was).
- **SoT** — Shots on Target (a football statistic used as a feature in the
  production outcome model).
- **OOS** — Out Of Sample (evaluating a model on data it wasn't fit on).
- **MLE** — Maximum Likelihood Estimation (the fitting method behind the
  Dixon-Coles model).
- **L2 (regularization)** — the L2-norm (sum-of-squares) penalty term, also called
  ridge or Tikhonov regularization, used to stabilize the Dixon-Coles fit.
- **PMF** — Probability Mass Function (used internally to compute Poisson
  probabilities in the Dixon-Coles model).
- **Precision / Recall / F1** — classification evaluation metrics reported by
  scikit-learn's `classification_report` for the v1 outcome model: Precision = of
  the predictions for a class, how many were correct; Recall = of the actual
  instances of a class, how many were found; F1 = the harmonic mean of the two.
- **Log loss** (a.k.a. cross-entropy) — the primary evaluation metric for the v2–v5
  outcome models: a proper scoring rule for probabilistic predictions that
  penalizes confident-and-wrong predictions more harshly than a plain accuracy
  score would.
- **Note on unused-here abbreviations**: this project does **not** use MSE (Mean
  Squared Error), MAE (Mean Absolute Error), RMSE (Root Mean Squared Error), ROC
  (Receiver Operating Characteristic), or AUC (Area Under the Curve) anywhere in its
  evaluated models — they are common ML metrics in general, but the actual metrics
  this codebase reports are Precision/Recall/F1 (v1 model) and log loss (v2–v5
  models), documented above rather than assumed.
- **xG** — Expected Goals, a well-known football analytics metric. **Not used
  anywhere in this codebase** — flagged here only because it's a common term in the
  domain this project is adjacent to; Sporty's football outcome modeling uses Elo
  and Dixon-Coles instead, not an xG model.

## Domain-specific (Sporty)

- **GKP / DEF / MID / FWD** — football lineup position codes: Goalkeeper, Defender,
  Midfielder, Forward.
- **FPL** — Fantasy Premier League, the official English Premier League fantasy
  game, referenced repeatedly as the design inspiration for Sporty's draft/waiver/
  auto-substitution/captain rules.
- **FAAB** — Free-Agent Acquisition Budget, a waiver-bidding system Sporty
  deliberately did **not** implement (it uses rolling-priority waivers instead — see
  [06 — Algorithms](06_ALGORITHMS.md) §5a).
- **ILP auto-pick / auto-subs** — see [06 — Algorithms](06_ALGORITHMS.md).
- **Gameweek** — the product term for what the database models as a
  `TransferWindow` row (see [07 — Database](07_DATABASE.md)).

## Infrastructure

- **R2** — Cloudflare R2, an S3-API-compatible object storage service.
- **S3** — Amazon Simple Storage Service (the API shape R2 is compatible with).
- **Redis** — REmote DIctionary Server, an in-memory key-value data store used here
  as cache, pub/sub broker, session store, and Celery broker/backend.
- **Kafka** — Apache Kafka, a distributed event-streaming platform (used in this
  codebase's dormant realtime pipeline).
- **WS / SSE** — WebSocket / Server-Sent Events, the two realtime transport
  mechanisms Sporty uses to stream live match data to the browser.
- **APNs** — Apple Push Notification service.
- **FCM** — Firebase Cloud Messaging (referenced via the `firebase-admin`
  dependency for push notifications).

## Glossary usage note

Every abbreviation introduced in another chapter is spelled out at first use in that
chapter as well as here — this page exists as a single lookup point, not as the only
place a term is explained.

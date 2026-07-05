# 10 — Security

## Authentication model

Sporty uses **httpOnly-cookie JWT** (JSON Web Token) — the frontend never holds a
token in JavaScript. Three token types, all defined in `app/core/security.py` (a
deliberately pure module — no I/O, no DB, no FastAPI imports — so every function is
unit-testable):

- **Access token** — a short-lived JWT (`create_access_token`), payload `{sub: user
  UUID, exp, iat, type: "access"}`, signed HS256 with `JWT_SECRET_KEY`, default
  lifetime 90 minutes (`ACCESS_TOKEN_EXPIRE_MINUTES`; the `.env.example` default
  shown is 30 — the two numbers differ between the example file and the documented
  runtime default; treat the deployed `.env`'s actual value as authoritative).
  `decode_access_token` validates the signature and the `type` claim before trusting
  the payload.
- **Refresh token** — an **opaque** random string (`secrets.token_urlsafe(64)`), not
  a JWT, carrying no payload. It's looked up by its **SHA-256 hash** in the
  `refresh_tokens` table — the raw value is never persisted, only the hash, so a
  database leak alone can't be used to forge a session. Default lifetime 7 days.
- **Password-reset token** — a short-lived JWT with `type: "password_reset"`,
  decoded by a dedicated `decode_password_reset_token` function (distinct from
  access-token decoding, so a leaked reset token can't be reused as an access
  token even though both are JWTs signed with the same key).

Passwords are hashed with **bcrypt** via `passlib`. Google OAuth is a second,
parallel identity path (`verify_google_id_token` — validates issuer is
`accounts.google.com` and that the email is verified before trusting the payload),
with a `CheckConstraint` on `users` preventing a row that's neither fully local nor
fully google-backed.

## The cookie flow

`app/auth/router.py:_set_auth_cookies` sets two httpOnly cookies —
`access_token`, `refresh_token`. In production: `httponly=True, secure=True,
samesite="none"` (required for a cross-origin SPA to send cookies at all), scoped to
`COOKIE_DOMAIN`. `settings.validate_production()` runs at boot and **refuses to
start** if `COOKIE_SAME_SITE=none` is set without `COOKIE_SECURE=True` (browsers
reject that combination anyway, so this is a fail-fast check rather than new
protection).

`get_current_user` (`app/auth/dependencies.py`) reads the token from an
`Authorization: Bearer` header **or** the `access_token` cookie — the cookie is the
normal SPA path. `get_current_active_user` additionally rejects deactivated
accounts. League routes layer `require_league_member`/`require_league_owner` on top.

## Middleware stack (order is a security property in itself)

Applied outermost → innermost in `app/main.py`:

1. **Security headers** (`app/middleware/security_headers.py`) — CSP (Content
   Security Policy), HSTS (HTTP Strict Transport Security), X-Frame-Options,
   X-Content-Type-Options on every response.
2. **CORS** (Cross-Origin Resource Sharing) — environment-driven origin allowlist
   (`CORS_PRODUCTION_ORIGINS`/`CORS_STAGING_ORIGINS`/`CORS_LOCAL_ORIGINS`) plus a
   regex accepting Vercel preview subdomains; `allow_credentials=True` (required for
   cookies to be sent cross-origin); `expose_headers` exposes `X-CSRF-Token` and
   rate-limit headers so JS can read them.
3. **CSRF** (Cross-Site Request Forgery) double-submit (below).
4. **Rate limiting** (below).

Plus two global exception handlers: a catch-all returning a generic `500` (never
leaking a traceback to the client) and a `ValueError → 400` mapper.

## CSRF protection — header-only double-submit

Because auth is cookie-based, the browser auto-attaches credentials to every
request to the API's origin — without CSRF protection, a malicious site could embed
a hidden form/fetch that rides the victim's session. `app/middleware/csrf.py`
implements a **header-only double-submit** pattern (no separate CSRF cookie, so it
works cross-origin without `SameSite` friction):
- On a non-exempt **GET**, generate a random token (`secrets.token_hex(32)`), store
  its hash in Redis (`csrf:<hash>`, 1h TTL), return the raw token in the
  `X-CSRF-Token` response header.
- On **POST/PUT/PATCH/DELETE**, require that header and validate its hash against
  Redis. Missing/invalid → `403`, with a fresh token issued for retry.
- **Exempt**: health/docs/openapi, auth endpoints (login/register/google/forgot-
  password/reset-password/refresh — no session exists yet to hijack on these, and
  they're rate-limited instead), and the feeder's `/api/v1/feed/*` path (a
  server-to-server call with no browser session at all).
- **Fail-open**: if Redis is unreachable, CSRF enforcement is skipped (logged as a
  warning) — an explicit availability-over-enforcement trade-off for this specific
  concern (contrast with the auth *token* check, which fails closed no matter what).

## Rate limiting

`app/middleware/rate_limiter.py` — IP-based sliding-window counters in Redis
(`INCR` + `EXPIRE`), applied **only** to auth endpoints by default: login (10/min),
register (5/min), refresh (20/min), forgot-password (3/min), reset-password
(5/min) — all configurable via `RATE_LIMIT_*` env vars. Client IP resolution order:
`X-Forwarded-For` → `X-Real-IP` → socket address. Over the limit → `429` +
`Retry-After`. Also fails open on a Redis outage.

## The feeder's separate trust boundary

`/api/v1/feed/*` uses **none** of the user-auth machinery. `verify_feeder_secret`
(`app/api/v1/feed.py`) compares the `X-Feeder-Secret` request header against
`settings.FEEDER_SECRET` using `secrets.compare_digest` (constant-time comparison —
prevents a timing side-channel from leaking the secret one byte at a time), returns
`503` if the backend has no secret configured at all (fail closed on
misconfiguration, not fail open), `401` on mismatch, and never logs the secret
value. This is a deliberate **separate** boundary: server-to-server, no cookies, no
CSRF (there is no browser session to protect), no rate limiting.

## OWASP Top 10 — how each is addressed (or not) in this codebase

| Risk | Handling | Where |
|---|---|---|
| **Injection (SQL)** | SQLAlchemy ORM/Core parameterized queries throughout; the few raw `text(...)` SQL statements (e.g. the async player-name resolver in `app/api/routes/match.py`) use bound parameters (`:ids`), never string interpolation | `app/services/scoring/*`, `app/api/routes/match.py` |
| **Broken authentication** | httpOnly cookies (token never in JS), bcrypt password hashing, opaque (non-JWT) refresh tokens stored only as a hash, session revocation on password change | `app/core/security.py`, `app/auth/*` |
| **Sensitive data exposure** | Reset tokens stored as hashes only; refresh tokens stored as hashes only; the feeder secret is never logged; a generic `500` never leaks stack traces to clients | `app/main.py` exception handler, `app/auth/models.py` |
| **XML External Entities (XXE)** | Not applicable — the system exchanges JSON, not XML, anywhere evidenced | — |
| **Broken access control** | `require_league_member`/`require_league_owner` dependencies gate league-scoped mutations; self-only checks on user profile updates | `app/league/dependencies.py` |
| **Security misconfiguration** | `validate_production()` fails the boot on unsafe cookie combinations and a too-short JWT secret; CORS origins are environment-driven, not wildcarded | `app/core/config.py` |
| **Cross-Site Scripting (XSS)** | No token in `localStorage`/JS-readable storage to steal via XSS; CSP header set on every response; frontend has a `sanitize.ts` utility (**not independently audited for completeness in this pass**) | `app/middleware/security_headers.py`, `sporty-frontend/src/lib/sanitize.ts` |
| **Insecure deserialization** | Not applicable in the observed request paths — Pydantic validates/deserializes JSON; the feeder's own use of Python's `pickle` for `.pkl` model files is a **local, non-network-facing** trust boundary (a `.pkl` is never accepted from an HTTP request; it's loaded from a local `models_pkl/` directory the operator controls), so this is not remotely exploitable as observed |
| **Using components with known vulnerabilities** | **Could not determine** from this repository — no `pip-audit`/`npm audit`/Dependabot configuration was found; dependency versions are pinned in `requirements.txt`/`package.json` but nothing here shows they're actively scanned |
| **Insufficient logging & monitoring** | Structured logging exists throughout (`logger.info`/`.warning`/`.exception`), and `/metrics` is exposed for Prometheus, but **no centralized log aggregation or alerting configuration was found in the repository** — see [09 — Deployment](09_DEPLOYMENT.md) |

## Secrets management

All secrets (`JWT_SECRET_KEY`, `FEEDER_SECRET`, `R2_SECRET_ACCESS_KEY`,
`RESEND_API_KEY`, RapidAPI keys, etc.) are environment variables, sourced from a
git-ignored `.env` locally and from the hosting platform's own secret store in
deployment (inferred; not directly evidenced by an in-repo secrets manager
integration). `.env.example` documents every variable's name and shape but contains
no real values. **Could not determine** whether the platform uses a dedicated
secrets manager (e.g. a vault service) versus plain platform environment variables —
no such integration is referenced in the codebase.

## Frontend-side security posture

- **No token in JavaScript** — the single biggest XSS-mitigation decision in the
  whole stack: even a successful script-injection attack can't exfiltrate an auth
  token that was never accessible to JS in the first place.
- **In-memory-only CSRF token** — deliberately not `localStorage` (`src/api/
  public-api-client.ts` comment: "never localStorage, for XSS safety").
- **401 auto-refresh de-duping** — prevents a thundering-herd of refresh calls, and
  on unrecoverable failure clears the user and redirects to login rather than
  leaving a stale, silently-broken session in place.

## Explain Like I'm New

Think of the CSRF token as a wristband handed out at the door (on a GET request) and
checked before letting you make any changes (POST/PUT/PATCH/DELETE) — it proves the
request actually came from the real website, not a copycat site tricking your
browser into sending your login cookie somewhere it shouldn't. The feeder's shared
secret is a completely different kind of check — more like a staff badge for a
service entrance that regular customers (browsers) never use at all.

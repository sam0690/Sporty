# 03 — Auth & Security

Authentication is **httpOnly-cookie JWT** with a **CSRF double-submit** token and per-endpoint
rate limiting. The frontend never sees a token in JavaScript. This chapter covers the token
model, the cookie flow, the three security middlewares, and Google OAuth.

## Token model (`app/core/security.py`)

`security.py` is intentionally pure — no I/O, no DB, no FastAPI imports — so every function is
unit-testable with plain data.

- **Access token** — a short-lived JWT (`create_access_token`). Payload: `sub` (user UUID),
  `exp`, `iat`, `type: "access"`. Signed HS256 with `JWT_SECRET_KEY`. Lifetime
  `ACCESS_TOKEN_EXPIRE_MINUTES` (config default 90). `decode_access_token` validates signature,
  checks `type == "access"`, and returns a typed `AccessTokenPayload(sub=UUID)` or `None`.
- **Refresh token** — an **opaque** random string (`secrets.token_urlsafe(64)`), **not** a JWT.
  It carries no payload; it is looked up by SHA-256 hash in the `refresh_tokens` table.
  Lifetime `REFRESH_TOKEN_EXPIRE_DAYS` (default 7).
- **Password reset token** — a short-lived JWT with `type: "password_reset"`, decoded by
  `decode_password_reset_token`.

Passwords are bcrypt via passlib (`hash_password`/`verify_password`).

## Cookie flow (`app/auth/router.py`)

The auth router sets two httpOnly cookies via `_set_auth_cookies`: `access_token` and
`refresh_token`. In production these are `httponly=True, secure=True, samesite="none"`
(required for cross-origin SPA cookie auth), scoped to path `/` and the configured
`COOKIE_DOMAIN`. `settings.validate_production()` (run in the lifespan) refuses to boot if
`COOKIE_SAME_SITE=none` without `COOKIE_SECURE=True`, since browsers reject that combination.

Endpoints (`/api/v1/auth/...`):
- `POST /register` — create a user; `auto_login=true` also sets cookies immediately.
- `POST /login` — username/email + password → sets cookies, returns `{"detail": "Login successful"}`.
- `POST /google` — Google sign-in/up via authorization code (see below). 409 if an account
  with that email already exists under a different method (returns a link token).
- `POST /refresh` — **token rotation**: reads the refresh token from the cookie (or body),
  revokes the old one, issues a new pair, sets fresh cookies.
- `POST /forgot-password` / `POST /reset-password` — emailed reset flow; reset revokes all sessions.
- `POST /logout` — revokes the current refresh token server-side and clears cookies.
- `POST /logout/all` — revokes **all** the user's refresh tokens (post-password-change or
  suspected compromise).
- `GET /me` — the current user profile (used by the frontend to bootstrap the session).
- `POST /change-password` — verifies current password, changes it, revokes all sessions.

### How a request is authenticated (`app/auth/dependencies.py`)

`get_current_user` reads the token from the `Authorization: Bearer` header **or** the
`access_token` cookie (cookie is the normal SPA path), decodes it, and loads the `User`.
`get_current_active_user` additionally rejects deactivated accounts (403). Routers depend on
`get_current_active_user`; league routes layer `require_league_member`/`require_league_owner`
on top (`app/league/dependencies.py`).

## Google OAuth (`verify_google_id_token`)

The frontend completes Google sign-in and sends the resulting ID token/code. The backend
verifies it with Google's library, checks the **issuer** is `accounts.google.com` and that the
email is **verified**, then returns a `GooglePayload`. From there the service either logs in an
existing google user, links to an existing local account (via a one-time link token, the 409
flow), or creates a new google user.

## Middleware stack (order matters — `app/main.py`)

Middleware is applied outermost → innermost:

1. **Security headers** (`app/middleware/security_headers.py`) — CSP, HSTS, X-Frame-Options,
   X-Content-Type-Options on every response.
2. **CORS** — origins are environment-driven (`settings.get_cors_origins()`:
   `CORS_PRODUCTION_ORIGINS` / `CORS_STAGING_ORIGINS` / `CORS_LOCAL_ORIGINS`, plus the derived
   frontend origin). `allow_credentials=True`, an `allow_origin_regex` accepts Vercel preview
   subdomains, and `expose_headers` exposes `X-CSRF-Token` and the rate-limit headers so JS can
   read them cross-origin. A small diagnostics middleware logs the incoming `Origin`.
3. **CSRF** (`app/middleware/csrf.py`) — see below.
4. **Rate limiting** (`app/middleware/rate_limiter.py`) — see below.

There are also two global exception handlers: a catch-all that logs the traceback and returns a
generic 500 (never leaks internals), and a `ValueError` handler that maps to 400.

### CSRF — SPA-friendly double-submit (`app/middleware/csrf.py`)

Because auth is cookie-based, the browser auto-sends credentials, so state-changing requests
need CSRF protection. The implementation is a **header-only double-submit** (no CSRF cookie, so
it works cross-origin without SameSite issues):

- On any **GET** (non-exempt), the middleware generates a random token
  (`secrets.token_hex(32)`), stores its **hash** in Redis with a 1h TTL (`csrf:<hash> = 1`),
  and returns it in the `X-CSRF-Token` response header.
- On **POST/PUT/PATCH/DELETE**, the middleware requires an `X-CSRF-Token` request header and
  validates it against Redis. Missing/expired → 403 with a fresh token in the header for retry.
- **Exempt** paths: health/docs/openapi, and importantly **auth endpoints**
  (`/api/v1/auth/login|register|google|forgot-password|reset-password|refresh`) — there is no
  authenticated session to hijack on those, and they're protected by rate limiting instead. The
  feeder path `/api/v1/feed` is also exempt (server-to-server, no browser session; authed by a
  shared secret instead).
- **Fail-open**: if Redis is unreachable, CSRF enforcement is skipped (with a warning) so an
  infra hiccup doesn't lock everyone out.

The frontend side of this contract lives in `sporty-frontend/src/api/public-api-client.ts` and
`auth-api-client.ts`: they capture the `X-CSRF-Token` from GET responses into an **in-memory**
variable (never localStorage) and attach it to every mutating request. See [09](09-frontend-architecture.md).

### Rate limiting (`app/middleware/rate_limiter.py`)

IP-based sliding-window counters in Redis (`INCR` + `EXPIRE`). Only auth endpoints are rate-
limited by default, each with its own limit from config: login (10/min), register (5/min),
refresh (20/min), forgot-password (3/min), reset-password (5/min). Client IP is taken from
`X-Forwarded-For` → `X-Real-IP` → socket. Every response gets `X-RateLimit-*` headers; over the
limit returns 429 with `Retry-After`. Also **fail-open** if Redis is down.

## The feeder's own auth

The simulator pushes data to `/api/v1/feed/*` with an `X-Feeder-Secret` header (see
`app/api/v1/feed.py:verify_feeder_secret`): 503 if the backend has no `FEEDER_SECRET`
configured, 401 on mismatch (compared with `secrets.compare_digest`), and the secret value is
never logged. This is a separate trust boundary from user auth — no cookies, no CSRF. See
[08](08-live-match-pipeline.md) and [10](10-sporty-data-feeder.md).

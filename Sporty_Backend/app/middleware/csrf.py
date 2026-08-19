"""
CSRF Protection Middleware
─────────────────────────
Cross-Site Request Forgery protection for cookie-based authentication.

Why CSRF protection matters:
  - When using httpOnly cookies for auth, the browser automatically
    sends credentials with every request to the domain.
  - An attacker can craft a malicious page that submits a form to
    your API, and the browser will include the auth cookies.
  - Without CSRF protection, the attack succeeds because the server
    sees valid credentials and processes the request.

How this implementation works (SPA-compatible):
  1. On GET requests, a CSRF token is generated and returned in the
     X-CSRF-Token response header. The frontend reads this header
     and stores the token in memory.
  2. On state-changing requests (POST, PUT, PATCH, DELETE), the
     middleware verifies that the X-CSRF-Token header is present
     and matches a valid token.
  3. Auth endpoints (login, register, etc.) are exempt from CSRF
     because there is no authenticated session to hijack.

SPA-compatible Double-Submit Pattern:
  - The backend generates a token and returns it in a response header
  - The frontend stores it in memory (not in localStorage for security)
  - On state-changing requests, the frontend sends the token in a header
  - The backend validates the header token
  - No cookie dependency — works cross-origin without SameSite issues

Why auth endpoints are exempt:
  - CSRF attacks target authenticated sessions
  - Login/register have no session to hijack
  - An attacker forging a login would log themselves in, not the victim
  - Rate limiting provides brute-force protection for these endpoints

Security properties:
  - Token is cryptographically random (secrets.token_hex(32))
  - Tokens are stored in Redis with TTL for validation
  - Auth endpoints exempt (no session to protect)
  - Rate limiting protects anonymous endpoints

Frontend integration:
  - Read X-CSRF-Token header from any GET response
  - Store token in memory (JavaScript variable)
  - Include X-CSRF-Token header with all state-changing requests
  - On 403 CSRF error, fetch a new token via GET and retry
"""

import logging
import secrets
import hashlib
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.config import settings
from app.core.redis import get_redis

logger = logging.getLogger(__name__)

# HTTP methods that require CSRF protection
UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

# Safe methods that never need CSRF protection
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}

# Auth endpoints exempt from CSRF — no authenticated session to hijack.
# These are protected by rate limiting instead.
AUTH_EXEMPT_PATHS = [
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/google",
    "/api/v1/auth/forgot-password",
    "/api/v1/auth/reset-password",
    "/api/v1/auth/refresh",
]


def generate_csrf_token() -> str:
    """Generate a cryptographically secure CSRF token."""
    return secrets.token_hex(32)


def _hash_csrf_token(token: str) -> str:
    """Hash a CSRF token for secure storage in Redis."""
    return hashlib.sha256(token.encode()).hexdigest()


async def _store_csrf_token(token: str, ttl: int = 3600) -> bool:
    """Store a CSRF token hash in Redis with TTL."""
    try:
        redis = get_redis()
        key = f"csrf:{_hash_csrf_token(token)}"
        redis.setex(key, ttl, "1")
        return True
    except Exception:
        # False means "Redis is unreachable", not "token rejected". Callers
        # decide what to do with that: minting a token on a GET tolerates it,
        # validating one on a write does not. See dispatch().
        logger.exception("Failed to store CSRF token in Redis")
        return False


async def _validate_csrf_token(token: str) -> bool | None:
    """Validate a CSRF token against Redis store.

    Returns:
        True when the token is valid.
        False when Redis is reachable and the token is invalid/missing.
        None when Redis is unavailable and CSRF should fail open.
    """
    try:
        redis = get_redis()
        key = f"csrf:{_hash_csrf_token(token)}"
        return redis.exists(key) == 1
    except Exception:
        # None is the third state: not "invalid", but "we cannot tell".
        # dispatch() answers 503 for it — see the fail-closed note there.
        logger.exception("Failed to validate CSRF token in Redis")
        return None


def _redis_unavailable(request: Request) -> JSONResponse:
    """Fail CLOSED: refuse a state-changing request we cannot CSRF-check.

    Both call sites here used to `return await call_next(request)` — i.e. a Redis
    outage silently turned CSRF protection off for every POST/PUT/PATCH/DELETE
    on the API, logging a warning and processing the write anyway. That is the
    one moment you least want the check skipped, and it happened automatically.

    503 rather than 403: the request may well have been perfectly valid, and the
    client should retry rather than go fetch a new token it doesn't need. No
    X-CSRF-Token header on this response — we couldn't store one, so handing the
    client a token that will fail validation just costs it another round trip.
    """
    logger.error(
        "Refusing %s %s: CSRF store unavailable (failing closed)",
        request.method,
        request.url.path,
    )
    return JSONResponse(
        status_code=503,
        content={"detail": "Service temporarily unavailable. Please retry shortly."},
        headers={"Retry-After": "5"},
    )


class CSRFMiddleware(BaseHTTPMiddleware):
    """
    CSRF protection middleware compatible with SPA frontends.

    Uses a header-only pattern (no cookie dependency):
    1. GET responses include X-CSRF-Token header
    2. Frontend stores token in memory
    3. POST/PUT/PATCH/DELETE requests must include X-CSRF-Token header
    4. Token is validated against Redis store

    Auth endpoints are exempt (no session to protect).
    """

    def __init__(self, app, exempt_paths: list[str] | None = None):
        super().__init__(app)
        self.exempt_paths = list(exempt_paths or [])
        self.exempt_paths.extend(settings.get_csrf_exempt_paths())
        self.exempt_paths.extend(AUTH_EXEMPT_PATHS)
        # Deduplicate
        self.exempt_paths = list(set(self.exempt_paths))

    def _is_exempt(self, path: str) -> bool:
        """Check if a path is exempt from CSRF protection."""
        for exempt_path in self.exempt_paths:
            if path.startswith(exempt_path):
                return True
        return False

    def _is_safe_method(self, method: str) -> bool:
        """Check if an HTTP method is safe (read-only)."""
        return method.upper() in SAFE_METHODS

    async def dispatch(self, request: Request, call_next):
        # Skip CSRF for safe methods — but still generate token for GET
        if self._is_safe_method(request.method):
            response = await call_next(request)
            # Generate and attach CSRF token to GET responses
            if request.method == "GET" and not self._is_exempt(request.url.path):
                csrf_token = generate_csrf_token()
                if await _store_csrf_token(csrf_token):
                    response.headers["X-CSRF-Token"] = csrf_token
            return response

        # Skip CSRF for exempt paths (auth endpoints, health checks, etc.)
        if self._is_exempt(request.url.path):
            return await call_next(request)

        # Skip CSRF if disabled in config
        if not settings.CSRF_ENABLED:
            return await call_next(request)

        # Validate CSRF token for state-changing requests
        csrf_header = request.headers.get(settings.CSRF_HEADER_NAME)

        if not csrf_header:
            redis_available = await _store_csrf_token(generate_csrf_token())
            if not redis_available:
                return _redis_unavailable(request)

            # No CSRF token — return 403 with a new token for retry
            logger.warning(
                "CSRF token missing for %s %s from %s",
                request.method,
                request.url.path,
                request.client.host if request.client else "unknown",
            )
            new_token = generate_csrf_token()
            await _store_csrf_token(new_token)
            return JSONResponse(
                status_code=403,
                content={
                    "detail": "CSRF token missing. Include X-CSRF-Token header with your request.",
                    "csrf_required": True,
                },
                headers={"X-CSRF-Token": new_token},
            )

        # Validate the token
        token_is_valid = await _validate_csrf_token(csrf_header)
        if token_is_valid is None:
            return _redis_unavailable(request)

        if not token_is_valid:
            logger.warning(
                "CSRF token invalid/expired for %s %s from %s",
                request.method,
                request.url.path,
                request.client.host if request.client else "unknown",
            )
            new_token = generate_csrf_token()
            await _store_csrf_token(new_token)
            return JSONResponse(
                status_code=403,
                content={
                    "detail": "CSRF token expired. Please fetch a new token and retry.",
                    "csrf_required": True,
                },
                headers={"X-CSRF-Token": new_token},
            )

        # Token validated — proceed with request
        response = await call_next(request)
        return response

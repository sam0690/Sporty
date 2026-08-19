"""
Rate Limiting Middleware
────────────────────────
IP-based rate limiting using Redis sliding window counters.

Why rate limiting matters:
  - Prevents brute-force attacks on auth endpoints
  - Protects against credential stuffing
  - Mitigates API abuse and scraping
  - Reduces infrastructure costs from abusive traffic

Implementation:
  - Uses Redis INCR with TTL for sliding window
  - Different limits per endpoint category
  - Supports X-Forwarded-For for proxy/CDN environments
  - Returns 429 Too Many Requests with Retry-After header
"""

import time
import logging
from fastapi import Request, Response, status
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.redis import get_redis

logger = logging.getLogger(__name__)

# Rate limit configurations per path pattern
# Format: (path_prefix, requests_per_window, window_seconds)
RATE_LIMIT_RULES = [
    # Auth endpoints - strictest limits. Prefixes must match the actual
    # mounted path (app.include_router(auth_router, prefix="/api/v1") in
    # main.py) — these previously read "/auth/login" etc. without the
    # "/api/v1" mount prefix, so they never matched a real request and this
    # whole block was dead code.
    ("/api/v1/auth/login", settings.RATE_LIMIT_LOGIN_RPM, settings.RATE_LIMIT_WINDOW_SECONDS),
    ("/api/v1/auth/register", settings.RATE_LIMIT_REGISTER_RPM, settings.RATE_LIMIT_WINDOW_SECONDS),
    ("/api/v1/auth/refresh", settings.RATE_LIMIT_REFRESH_RPM, settings.RATE_LIMIT_WINDOW_SECONDS),
    ("/api/v1/auth/forgot-password", settings.RATE_LIMIT_FORGOT_PASSWORD_RPM, settings.RATE_LIMIT_WINDOW_SECONDS),
    ("/api/v1/auth/reset-password", settings.RATE_LIMIT_RESET_PASSWORD_RPM, settings.RATE_LIMIT_WINDOW_SECONDS),
    # Catch-all fallback — every other endpoint (transfers, waivers, etc.) had
    # zero rate limiting before this; RATE_LIMIT_GLOBAL_RPM existed in config
    # but was never actually wired into a rule. "" matches every path via
    # startswith, so keep this last — more specific rules above must win.
    ("", settings.RATE_LIMIT_GLOBAL_RPM, settings.RATE_LIMIT_WINDOW_SECONDS),
]


# Paths that must answer even when Redis is unreachable. check_rate_limit fails
# CLOSED, so without this carve-out a Redis outage would 503 the liveness probe,
# Render would mark every instance unhealthy, and a cache outage would escalate
# into a restart loop. These two are infrastructure endpoints — they are not
# worth rate limiting and they are exactly what you need working during an
# incident. /health is already CSRF-exempt via CSRF_EXEMPT_PATHS.
FAIL_OPEN_PATHS = {"/health", "/metrics"}


def get_client_ip(request: Request) -> str:
    """
    Extract the real client IP without trusting client-supplied headers.

    Proxies APPEND to X-Forwarded-For, so with TRUSTED_PROXY_HOPS=N the
    real client is the Nth entry from the right; everything left of it
    arrived from the client and is spoofable. The previous version took
    the LEFTMOST entry (and fell back to X-Real-IP, equally spoofable),
    so any client could rotate a fake header past every rate limit.
    X-Real-IP support is dropped for the same reason — nothing sets it here.
    """
    hops = settings.TRUSTED_PROXY_HOPS
    if hops > 0:
        forwarded_for = request.headers.get("x-forwarded-for", "")
        entries = [e.strip() for e in forwarded_for.split(",") if e.strip()]
        if entries:
            return entries[-hops] if len(entries) >= hops else entries[0]

    # Direct connection (or hops=0: forwarded headers ignored entirely)
    if request.client:
        return request.client.host

    return "unknown"


def check_rate_limit(client_ip: str, path: str) -> tuple[bool, dict]:
    """
    Check if request is within rate limits.

    Returns:
        (allowed: bool, limit_info: dict with remaining/reset info)
    """
    if not settings.RATE_LIMIT_ENABLED:
        return True, {}

    if path in FAIL_OPEN_PATHS:
        return True, {}

    # Find matching rate limit rule
    matching_rule = None
    for path_prefix, max_requests, window_seconds in RATE_LIMIT_RULES:
        if path.startswith(path_prefix):
            matching_rule = (path_prefix, max_requests, window_seconds)
            break

    if not matching_rule:
        return True, {}  # No rate limit for this path

    path_prefix, max_requests, window_seconds = matching_rule

    try:
        redis = get_redis()
        # Create a unique key per IP + endpoint
        rate_key = f"rl:{path_prefix}:{client_ip}"

        # One pipeline, one round trip. Redis is remote (Upstash), so latency
        # here is network latency — three sequential commands meant three RTTs
        # on EVERY request, which at ~50ms each is ~150ms of pure overhead
        # before any handler runs. Pipelined it's one.
        #
        # SET NX EX creates the counter and its TTL together, then INCR bumps
        # it. The older INCR-then-EXPIRE pair could die between the two commands
        # and leave a counter with no TTL, permanently blocking that IP+path.
        # Order matters: SET must come first.
        pipe = redis.pipeline()
        pipe.set(rate_key, 0, ex=window_seconds, nx=True)
        pipe.incr(rate_key)
        pipe.ttl(rate_key)
        _, current, ttl = pipe.execute()

        remaining = max(0, max_requests - current)

        limit_info = {
            "X-RateLimit-Limit": str(max_requests),
            "X-RateLimit-Remaining": str(remaining),
            "X-RateLimit-Reset": str(int(time.time()) + max(0, ttl)),
        }

        if current > max_requests:
            return False, limit_info

        return True, limit_info

    except Exception:
        # Fail CLOSED. This used to return (True, {}) — "allow" — which meant a
        # Redis outage silently disabled every rate limit at once, including the
        # login/register/forgot-password ones, with nothing but a log line to
        # say so. An attacker who can knock Redis over (or who just gets lucky
        # during an outage) gets unlimited brute-force attempts.
        #
        # The marker tells the middleware this is OUR failure, not the client
        # sending too much, so it can answer 503 rather than 429. FAIL_OPEN_PATHS
        # above keeps /health answering, so a Redis blip degrades the API instead
        # of failing the liveness probe and getting our instances recycled.
        logger.exception("Rate limiter failed, denying request (fail closed)")
        return False, {"X-RateLimit-Backend-Down": "1"}


class RateLimitMiddleware:
    """
    FastAPI middleware for IP-based rate limiting.

    Adds rate limit headers to all responses:
    - X-RateLimit-Limit: Maximum requests per window
    - X-RateLimit-Remaining: Requests remaining
    - X-RateLimit-Reset: Unix timestamp when window resets

    Returns 429 Too Many Requests when limit exceeded.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        # Only handle HTTP requests
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        # Create a minimal Request object for IP extraction
        from starlette.requests import Request as StarletteRequest

        request = StarletteRequest(scope, receive)
        client_ip = get_client_ip(request)
        path = scope.get("path", "")

        # Check rate limit
        allowed, limit_info = check_rate_limit(client_ip, path)

        if not allowed and limit_info.get("X-RateLimit-Backend-Down"):
            # We couldn't reach Redis, so we can't tell whether this request is
            # within its limit. 503 (not 429) because the fault is ours — a 429
            # would tell an honest client to back off for a problem it didn't
            # cause, and would poison client-side retry logic.
            response = JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={"detail": "Service temporarily unavailable. Please retry shortly."},
                headers={"Retry-After": "5"},
            )
            await response(scope, receive, send)
            return

        if not allowed:
            # Rate limit exceeded - return 429
            retry_after = int(limit_info.get("X-RateLimit-Reset", 0)) - int(time.time())
            response = JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": "Too many requests. Please try again later.",
                    "retry_after": max(1, retry_after),
                },
                headers={
                    **limit_info,
                    "Retry-After": str(max(1, retry_after)),
                },
            )
            await response(scope, receive, send)
            return

        # Request allowed - add rate limit headers to response
        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                # Add rate limit headers to response
                headers = list(message.get("headers", []))
                for key, value in limit_info.items():
                    headers.append((key.encode(), value.encode()))
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_with_headers)

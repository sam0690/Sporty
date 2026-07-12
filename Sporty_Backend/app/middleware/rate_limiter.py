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


def get_client_ip(request: Request) -> str:
    """
    Extract real client IP, respecting proxy headers.

    Order of precedence:
    1. X-Forwarded-For (first IP = original client)
    2. X-Real-IP (nginx convention)
    3. Direct connection IP

    Security note: In production, ensure your reverse proxy
    strips any client-supplied X-Forwarded-For headers to
    prevent spoofing.
    """
    # Check for proxy headers (set by nginx, cloudflare, etc.)
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        # First IP in the chain is the original client
        return forwarded_for.split(",")[0].strip()

    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()

    # Fallback to direct connection
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

        # Use Redis INCR with TTL for sliding window
        current = redis.incr(rate_key)

        # Set expiry on first request
        if current == 1:
            redis.expire(rate_key, window_seconds)

        ttl = redis.ttl(rate_key)
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
        # Fail open - don't block legitimate traffic if Redis is down
        logger.exception("Rate limiter failed, allowing request")
        return True, {}


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

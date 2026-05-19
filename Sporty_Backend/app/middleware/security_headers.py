"""
Security Headers Middleware
───────────────────────────
Production-grade HTTP security headers (Helmet.js equivalent for FastAPI).

Why security headers matter:
  - Content-Security-Policy: Prevents XSS by controlling resource loading
  - X-Frame-Options: Prevents clickjacking via iframe embedding
  - X-Content-Type-Options: Prevents MIME type sniffing attacks
  - Strict-Transport-Security: Forces HTTPS connections
  - Referrer-Policy: Controls information leakage in referrer headers
  - Permissions-Policy: Restricts browser features (camera, microphone, etc.)
  - X-XSS-Protection: Legacy XSS filter (defense in depth)

CSP strategy:
  - API responses (/api/*): strict CSP, no external resources
  - Docs pages (/docs, /redoc): allow Swagger/ReDoc CDN assets
  - All other responses: default strict CSP

This path-aware approach ensures Swagger UI works while keeping
API responses locked down.
"""

import logging
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.core.config import settings

logger = logging.getLogger(__name__)

# Paths that serve documentation UI and need relaxed CSP
DOCS_PATHS = ("/docs", "/redoc", "/docs/oauth2-redirect")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Adds production security headers to all HTTP responses.

    Uses path-aware CSP:
    - Documentation pages: allow CDN assets for Swagger UI / ReDoc
    - API responses: strict CSP, no external resources
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        path = request.url.path

        # ── Content-Security-Policy ─────────────────────────────
        # Path-aware CSP to support Swagger UI while keeping API strict.
        if path in DOCS_PATHS or path.startswith("/docs"):
            # Documentation pages need CDN assets for Swagger UI
            # Swagger UI loads from cdn.jsdelivr.net:
            #   - swagger-ui-bundle.js (JavaScript)
            #   - swagger-ui.css (stylesheet)
            #   - swagger-ui-standalone-preset.js (JS preset)
            csp_directives = [
                "default-src 'self'",
                # Allow Swagger UI JS from jsdelivr CDN
                "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
                # Allow Swagger UI CSS from jsdelivr CDN
                "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
                # Allow Swagger UI favicon and images
                "img-src 'self' data: https: blob: https://fastapi.tiangolo.com",
                # Allow fonts
                "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
                # Allow Swagger UI to fetch the OpenAPI JSON from same origin
                "connect-src 'self'",
                # Prevent iframe embedding
                "frame-ancestors 'none'",
                "base-uri 'self'",
                "form-action 'self'",
                "upgrade-insecure-requests",
            ]
        else:
            # API responses — strict CSP, no external resources
            csp_directives = [
                "default-src 'self'",
                "script-src 'self'",
                "style-src 'self' 'unsafe-inline'",
                "img-src 'self' data: https: blob:",
                "font-src 'self' https://fonts.gstatic.com",
                "connect-src 'self' https://*.api-sports.io https://*.rapidapi.com https://*.googleapis.com",
                "frame-ancestors 'none'",
                "base-uri 'self'",
                "form-action 'self'",
                "upgrade-insecure-requests",
            ]

        response.headers["Content-Security-Policy"] = "; ".join(csp_directives)

        # ── X-Frame-Options ─────────────────────────────────────
        # Prevents the page from being embedded in iframes.
        # Protects against clickjacking attacks.
        # DENY = never allow framing; SAMEORIGIN = allow same origin only.
        response.headers["X-Frame-Options"] = "DENY"

        # ── X-Content-Type-Options ──────────────────────────────
        # Prevents browsers from MIME-type sniffing responses.
        # Stops attacks where a file is served as one type but
        # interpreted as another (e.g., image served as HTML).
        response.headers["X-Content-Type-Options"] = "nosniff"

        # ── Strict-Transport-Security (HSTS) ────────────────────
        # Forces browsers to use HTTPS for all future requests.
        # Only enabled in production where HTTPS is guaranteed.
        #
        # max-age=31536000 = 1 year
        # includeSubDomains = apply to all subdomains
        # preload = eligible for browser HSTS preload list
        if settings.ENVIRONMENT == "production":
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )

        # ── Referrer-Policy ─────────────────────────────────────
        # Controls how much referrer information is sent with requests.
        # strict-origin-when-cross-origin:
        #   - Full URL for same-origin requests
        #   - Only origin for cross-origin requests
        #   - No referrer for HTTPS→HTTP downgrades
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # ── Permissions-Policy ──────────────────────────────────
        # Restricts browser features that the page can use.
        # Denies access to sensitive APIs unless explicitly needed.
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), "
            "payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()"
        )

        # ── X-XSS-Protection ────────────────────────────────────
        # Legacy XSS filter for older browsers.
        # Modern browsers use CSP instead, but this provides
        # defense-in-depth for older clients.
        response.headers["X-XSS-Protection"] = "0"  # Disabled in favor of CSP

        # ── Cache-Control ───────────────────────────────────────
        # API responses: prevent caching by default.
        # Docs pages: allow browser caching for performance.
        if path not in DOCS_PATHS and not path.startswith("/docs"):
            if not response.headers.get("Cache-Control"):
                response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate"
                response.headers["Pragma"] = "no-cache"
                response.headers["Expires"] = "0"

        # ── Remove server identification ────────────────────────
        # Remove FastAPI/Starlette server header to reduce
        # information disclosure about the tech stack.
        if "server" in response.headers:
            del response.headers["server"]

        return response

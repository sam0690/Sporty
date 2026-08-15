"""SecurityHeadersMiddleware stamps `Cache-Control: no-store` on every API
response unless the route already set one. app/core/http_cache.public_cache is
that opt-out, used on the handful of unauthenticated, caller-independent GETs.

The important assertion here is the negative one: an ordinary route must still
come back `no-store`. `public` permits *shared* caches, so if the opt-out ever
leaked onto an authenticated route, one user's response could be served to
another.
"""
from __future__ import annotations

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.core.http_cache import public_cache
from app.middleware.security_headers import SecurityHeadersMiddleware


def _client() -> TestClient:
    app = FastAPI()
    app.add_middleware(SecurityHeadersMiddleware)

    @app.get("/api/v1/private")
    def private():
        return {"ok": True}

    @app.get("/api/v1/public", dependencies=[Depends(public_cache(60))])
    def public():
        return {"ok": True}

    @app.get("/api/v1/snapshot", dependencies=[Depends(public_cache(300, 600))])
    def snapshot():
        return {"ok": True}

    return TestClient(app)


def test_ordinary_route_is_still_no_store():
    response = _client().get("/api/v1/private")
    assert "no-store" in response.headers["cache-control"]
    assert response.headers["pragma"] == "no-cache"


def test_public_cache_survives_the_middleware():
    response = _client().get("/api/v1/public")
    assert response.headers["cache-control"] == "public, max-age=60"
    # The blanket no-store path also sets Pragma/Expires; opted-out routes
    # must not carry those, or an HTTP/1.0 cache would ignore the max-age.
    assert "pragma" not in response.headers


def test_stale_while_revalidate_is_emitted():
    response = _client().get("/api/v1/snapshot")
    assert response.headers["cache-control"] == (
        "public, max-age=300, stale-while-revalidate=600"
    )


def test_security_headers_still_applied_to_cached_routes():
    """The opt-out is scoped to Cache-Control — CSP/HSTS/etc. are unconditional."""
    response = _client().get("/api/v1/public")
    assert "content-security-policy" in response.headers
    assert response.headers["x-content-type-options"] == "nosniff"

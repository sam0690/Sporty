"""Guard the one way HTTP caching can go wrong: `public` on an authed route.

app/core/http_cache.public_cache marks a response cacheable by SHARED caches.
On a route that varies by caller, that means one user's response can be served
to another. This walks the real app's route table and asserts the two sets are
disjoint — so adding public_cache to an authenticated endpoint fails here
rather than in production.
"""
from __future__ import annotations

import pytest

from app.core.http_cache import public_cache


def _all_dependency_callables(route) -> set:
    """Every callable in the route's dependency tree, not just the top level."""
    seen = set()
    stack = list(getattr(route, "dependant", None).dependencies) if getattr(route, "dependant", None) else []
    while stack:
        dep = stack.pop()
        if dep.call is not None:
            seen.add(dep.call)
        stack.extend(dep.dependencies)
    return seen


@pytest.fixture(scope="module")
def app():
    from app.main import app as fastapi_app

    return fastapi_app


def _is_public_cached(route) -> bool:
    # public_cache() returns a fresh closure per call; identify it by the
    # function it builds rather than by identity.
    return any(
        getattr(call, "__name__", "") == "_apply"
        and getattr(call, "__qualname__", "").startswith("public_cache")
        for call in _all_dependency_callables(route)
    )


def _is_authenticated(route) -> bool:
    auth_names = {
        "get_current_active_user",
        "get_current_user",
        "get_current_admin_user",
        "require_league_member",
        "require_league_owner",
    }
    return any(
        getattr(call, "__name__", "") in auth_names
        for call in _all_dependency_callables(route)
    )


def test_public_cache_is_never_on_an_authenticated_route(app):
    offenders = [
        f"{sorted(route.methods)} {route.path}"
        for route in app.routes
        if getattr(route, "dependant", None)
        and _is_public_cached(route)
        and _is_authenticated(route)
    ]
    assert offenders == [], (
        "public_cache permits shared caching — these routes vary by caller "
        f"and must not use it: {offenders}"
    )


def test_the_expected_public_routes_are_actually_cached(app):
    """Pins the opt-in list, so a refactor that drops the dependency is caught."""
    cached = {
        route.path
        for route in app.routes
        if getattr(route, "dependant", None) and _is_public_cached(route)
    }
    expected = {
        "/api/v1/competitions",
        "/api/v1/competitions/{tag}/standings",
        "/api/v1/competitions/{tag}/scorers",
        "/api/v1/competitions/{tag}/matches",
        "/api/v1/competitions/{tag}/matches/{match_id}",
        "/api/v1/fixtures",
        "/api/v1/fixtures/next",
        "/api/v1/matches",
        "/api/v1/matches/public",
        "/api/v1/players/public/{player_id}",
        "/api/v1/players/public/{player_id}/recent-stats",
    }
    assert cached == expected


def test_public_cache_builds_the_expected_header_value():
    applied: dict[str, str] = {}

    class _Response:
        headers = applied

    public_cache(60)(_Response())
    assert applied["Cache-Control"] == "public, max-age=60"

    public_cache(300, stale_while_revalidate=600)(_Response())
    assert applied["Cache-Control"] == (
        "public, max-age=300, stale-while-revalidate=600"
    )

"""Redis outages must DENY, not silently wave requests through.

Before this, `csrf.py`, `rate_limiter.py` and `auth.services._is_login_rate_limited`
each caught Exception and returned "allowed". A single Redis blip therefore
disabled CSRF validation, the global rate limit, the per-endpoint auth rate
limits, and the per-account login throttle — all at once, with nothing but a log
line to say the protections were off.

These tests pin the inversion, plus the one carve-out that keeps it survivable:
/health must still answer, or Render's liveness probe fails during a Redis
outage and a cache problem escalates into instances being recycled.
"""

from __future__ import annotations

import asyncio

import pytest

from app.auth import services as auth_services
from app.middleware import csrf, rate_limiter


class _DeadPipeline:
    """redis-py builds the pipeline fine and raises on execute()."""

    def set(self, *a, **kw):
        return self

    def incr(self, *a, **kw):
        return self

    def ttl(self, *a, **kw):
        return self

    def execute(self):
        raise ConnectionError("redis is down")


class _DeadRedis:
    """Every command raises, the way redis-py behaves when it can't connect."""

    def _boom(self, *args, **kwargs):
        raise ConnectionError("redis is down")

    incr = expire = ttl = set = setex = exists = _boom

    def pipeline(self):
        return _DeadPipeline()


# ── rate limiter ──────────────────────────────────────────────────────────────

def test_rate_limiter_denies_when_redis_is_down(monkeypatch):
    monkeypatch.setattr(rate_limiter, "get_redis", lambda: _DeadRedis())

    allowed, info = rate_limiter.check_rate_limit("1.2.3.4", "/api/v1/auth/login")

    assert allowed is False
    # The marker is what lets the middleware answer 503 (our fault) rather than
    # 429 (client's fault) — without it an honest client gets told to back off.
    assert info.get("X-RateLimit-Backend-Down") == "1"


@pytest.mark.parametrize("path", ["/health", "/metrics"])
def test_probe_paths_stay_open_when_redis_is_down(monkeypatch, path):
    monkeypatch.setattr(rate_limiter, "get_redis", lambda: _DeadRedis())

    allowed, _ = rate_limiter.check_rate_limit("1.2.3.4", path)

    assert allowed is True, (
        f"{path} must answer during a Redis outage — a 503 here fails the "
        "liveness probe and gets healthy instances recycled mid-incident"
    )


def test_rate_limit_costs_exactly_one_round_trip(monkeypatch):
    """All three commands go in ONE pipeline.

    Redis is remote (Upstash), so each extra command is a network round trip on
    every single request. Three sequential calls at ~50ms each is ~150ms of
    latency before any handler runs.

    Also pins TTL atomicity: SET NX EX creates the key and its expiry together
    and must precede INCR. The older INCR-then-EXPIRE pair could die between
    the two commands and leave a TTL-less counter blocking that IP+path forever.
    """
    round_trips: list[list[str]] = []

    class _RecordingPipeline:
        def __init__(self):
            self.commands: list[str] = []

        def set(self, key, value, ex=None, nx=None):
            assert ex is not None and nx is True, "TTL must be set at creation"
            self.commands.append("set")
            return self

        def incr(self, key):
            self.commands.append("incr")
            return self

        def ttl(self, key):
            self.commands.append("ttl")
            return self

        def execute(self):
            round_trips.append(self.commands)
            return [True, 1, 60]

    class _RecordingRedis:
        def pipeline(self):
            return _RecordingPipeline()

    monkeypatch.setattr(rate_limiter, "get_redis", lambda: _RecordingRedis())

    allowed, _ = rate_limiter.check_rate_limit("9.9.9.9", "/api/v1/auth/login")

    assert allowed is True
    assert len(round_trips) == 1, f"expected 1 round trip, made {len(round_trips)}"
    assert round_trips[0] == ["set", "incr", "ttl"], "SET NX EX must precede INCR"


# ── CSRF ──────────────────────────────────────────────────────────────────────

class _FakeURL:
    def __init__(self, path: str):
        self.path = path


class _FakeRequest:
    def __init__(self, method: str, path: str, headers: dict | None = None):
        self.method = method
        self.url = _FakeURL(path)
        self.headers = headers or {}
        self.client = None


def _dispatch(request):
    """Run CSRFMiddleware.dispatch with a call_next that must not be reached."""

    async def _call_next(_request):
        raise AssertionError(
            "request reached the app — CSRF was skipped while Redis was down"
        )

    middleware = csrf.CSRFMiddleware(app=None)
    return asyncio.run(middleware.dispatch(request, _call_next))


def test_csrf_refuses_write_with_no_token_when_redis_is_down(monkeypatch):
    monkeypatch.setattr(csrf, "get_redis", lambda: _DeadRedis())

    response = _dispatch(_FakeRequest("POST", "/api/v1/leagues/abc/transfers"))

    assert response.status_code == 503
    # Not 403: the request may have been perfectly valid, and handing back a
    # token we failed to store just costs the client another round trip.
    assert "X-CSRF-Token" not in response.headers


def test_csrf_refuses_write_with_a_token_when_redis_is_down(monkeypatch):
    monkeypatch.setattr(csrf, "get_redis", lambda: _DeadRedis())

    response = _dispatch(
        _FakeRequest(
            "POST",
            "/api/v1/leagues/abc/transfers",
            headers={"X-CSRF-Token": "a" * 64},
        )
    )

    assert response.status_code == 503


def test_csrf_still_serves_reads_when_redis_is_down(monkeypatch):
    """GETs stay open — a read that can't mint a token should still return."""
    monkeypatch.setattr(csrf, "get_redis", lambda: _DeadRedis())

    sentinel = object()

    async def _call_next(_request):
        class _Resp:
            headers: dict = {}

        _Resp.sentinel = sentinel
        return _Resp()

    middleware = csrf.CSRFMiddleware(app=None)
    response = asyncio.run(
        middleware.dispatch(_FakeRequest("GET", "/api/v1/leagues"), _call_next)
    )

    assert response.sentinel is sentinel
    assert "X-CSRF-Token" not in response.headers


# ── per-account login throttle ────────────────────────────────────────────────

def test_login_throttle_denies_when_redis_is_down(monkeypatch):
    monkeypatch.setattr(auth_services, "get_redis", lambda: _DeadRedis())

    assert auth_services._is_login_rate_limited("victim@example.com") is True

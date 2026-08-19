"""RATE_LIMIT_RULES prefixes must match the actual mounted path
(app.include_router(..., prefix="/api/v1")) — a prior version omitted
"/api/v1" and so never matched a real request, silently disabling every
auth-specific rate limit. This pins the fix and the global catch-all.
"""

from __future__ import annotations

from app.core.config import settings
from app.middleware import rate_limiter


class _FakePipeline:
    """The three commands are pipelined into one round trip — Redis is remote
    (Upstash), so each extra RTT is real latency on every request. Queue on
    call, apply on execute(), same as redis-py."""

    def __init__(self, redis: "_FakeRedis"):
        self._redis = redis
        self._queued: list = []

    def set(self, key, value, ex=None, nx=False):
        self._queued.append(lambda: self._redis.set(key, value, ex=ex, nx=nx))
        return self

    def incr(self, key):
        self._queued.append(lambda: self._redis.incr(key))
        return self

    def ttl(self, key):
        self._queued.append(lambda: self._redis.ttl(key))
        return self

    def execute(self) -> list:
        return [op() for op in self._queued]


class _FakeRedis:
    def __init__(self):
        self.counts: dict[str, int] = {}

    def pipeline(self) -> _FakePipeline:
        return _FakePipeline(self)

    def set(self, key: str, value: int, ex: int | None = None, nx: bool = False) -> bool:
        # SET NX EX creates the counter and its TTL in one command (the old
        # INCR-then-EXPIRE pair could leave a TTL-less key that blocked its
        # IP+path forever). NX means "only if absent", so an existing counter
        # is left alone.
        if nx and key in self.counts:
            return False
        self.counts[key] = value
        return True

    def incr(self, key: str) -> int:
        self.counts[key] = self.counts.get(key, 0) + 1
        return self.counts[key]

    def ttl(self, key: str) -> int:
        return 60


def test_login_path_hits_the_login_specific_rule_not_the_catch_all(monkeypatch):
    fake = _FakeRedis()
    monkeypatch.setattr(rate_limiter, "get_redis", lambda: fake)

    for _ in range(settings.RATE_LIMIT_LOGIN_RPM):
        allowed, _ = rate_limiter.check_rate_limit("1.2.3.4", "/api/v1/auth/login")
        assert allowed is True

    allowed, info = rate_limiter.check_rate_limit("1.2.3.4", "/api/v1/auth/login")
    assert allowed is False
    assert info["X-RateLimit-Limit"] == str(settings.RATE_LIMIT_LOGIN_RPM)


def test_unmatched_path_falls_back_to_global_catch_all(monkeypatch):
    fake = _FakeRedis()
    monkeypatch.setattr(rate_limiter, "get_redis", lambda: fake)

    allowed, info = rate_limiter.check_rate_limit("5.6.7.8", "/api/v1/leagues/abc/transfers")
    assert allowed is True
    assert info["X-RateLimit-Limit"] == str(settings.RATE_LIMIT_GLOBAL_RPM)

    # Distinct bucket from the login rule above — different Redis key.
    assert fake.counts == {"rl::5.6.7.8": 1}

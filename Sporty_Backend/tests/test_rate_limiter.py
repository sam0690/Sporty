"""RATE_LIMIT_RULES prefixes must match the actual mounted path
(app.include_router(..., prefix="/api/v1")) — a prior version omitted
"/api/v1" and so never matched a real request, silently disabling every
auth-specific rate limit. This pins the fix and the global catch-all.
"""

from __future__ import annotations

from app.core.config import settings
from app.middleware import rate_limiter


class _FakeRedis:
    def __init__(self):
        self.counts: dict[str, int] = {}

    def incr(self, key: str) -> int:
        self.counts[key] = self.counts.get(key, 0) + 1
        return self.counts[key]

    def expire(self, key: str, ttl: int) -> None:
        pass

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

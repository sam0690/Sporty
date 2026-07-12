"""Per-account login throttle — closes the gap where the /auth/login
middleware rate limit is per-IP only, so credential stuffing spread across
many IPs against one account previously sailed through untouched.
"""

from __future__ import annotations

from app.auth import services as auth_services
from app.core.config import settings


class _FakeRedis:
    def __init__(self):
        self.counts: dict[str, int] = {}

    def incr(self, key: str) -> int:
        self.counts[key] = self.counts.get(key, 0) + 1
        return self.counts[key]

    def expire(self, key: str, ttl: int) -> None:
        pass


def test_login_rate_limit_allows_up_to_configured_attempts(monkeypatch):
    fake = _FakeRedis()
    monkeypatch.setattr(auth_services, "get_redis", lambda: fake)

    for _ in range(settings.RATE_LIMIT_LOGIN_ACCOUNT_MAX_ATTEMPTS):
        assert auth_services._is_login_rate_limited("someone@example.com") is False

    assert auth_services._is_login_rate_limited("someone@example.com") is True


def test_login_rate_limit_is_per_account_not_shared(monkeypatch):
    fake = _FakeRedis()
    monkeypatch.setattr(auth_services, "get_redis", lambda: fake)

    for _ in range(settings.RATE_LIMIT_LOGIN_ACCOUNT_MAX_ATTEMPTS + 1):
        auth_services._is_login_rate_limited("victim@example.com")

    # A different account (e.g. attacker rotating IPs but trying many
    # accounts) has its own untouched bucket.
    assert auth_services._is_login_rate_limited("someone-else@example.com") is False


def test_login_rate_limit_is_case_and_whitespace_insensitive(monkeypatch):
    fake = _FakeRedis()
    monkeypatch.setattr(auth_services, "get_redis", lambda: fake)

    for _ in range(settings.RATE_LIMIT_LOGIN_ACCOUNT_MAX_ATTEMPTS):
        auth_services._is_login_rate_limited("Someone@Example.com")

    assert auth_services._is_login_rate_limited(" someone@example.com ") is True


def test_login_rate_limit_fails_open_when_redis_unavailable(monkeypatch):
    def _raise():
        raise ConnectionError("redis down")

    monkeypatch.setattr(auth_services, "get_redis", _raise)

    assert auth_services._is_login_rate_limited("someone@example.com") is False

"""validate_production() cookie rules.

Production supports two cookie topologies:
  - same-site subdomains (sportyyy.tech + api.sportyyy.tech):
    SameSite=lax REQUIRES COOKIE_DOMAIN so both hosts share the cookie
  - unrelated domains: SameSite=none (+ Secure, browser-enforced)
Anything else must refuse to boot.
"""

from __future__ import annotations

import pytest

from app.core.config import Settings

BASE = dict(
    DATABASE_URL="postgresql://u:p@db.example.com/x",
    REDIS_URL="redis://r",
    JWT_SECRET_KEY="x" * 40,
    GOOGLE_CLIENT_ID="c",
    ENVIRONMENT="production",
    COOKIE_SECURE=True,
    CORS_PRODUCTION_ORIGINS="https://sportyyy.tech",
)


def _settings(**overrides) -> Settings:
    return Settings(_env_file=None, **{**BASE, **overrides})


def test_lax_with_cookie_domain_passes():
    _settings(COOKIE_SAME_SITE="lax", COOKIE_DOMAIN=".sportyyy.tech").validate_production()


def test_none_passes():
    _settings(COOKIE_SAME_SITE="none").validate_production()


def test_lax_without_cookie_domain_refuses_boot():
    with pytest.raises(ValueError, match="COOKIE_DOMAIN"):
        _settings(COOKIE_SAME_SITE="lax").validate_production()


def test_strict_refuses_boot():
    with pytest.raises(ValueError):
        _settings(COOKIE_SAME_SITE="strict").validate_production()


def test_insecure_cookies_refuse_boot():
    with pytest.raises(ValueError, match="COOKIE_SECURE"):
        _settings(
            COOKIE_SAME_SITE="lax", COOKIE_DOMAIN=".sportyyy.tech", COOKIE_SECURE=False
        ).validate_production()

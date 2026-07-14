"""Pins the C1 fix (PHASE1_AUDIT.md): no CORS origin regex, env-driven list only.

A previous allow_origin_regex matched every *.vercel.app deployment with
allow_credentials=True and X-CSRF-Token in expose_headers — a full CSRF
bypass. The app inspection runs in a subprocess so importing app.main (which
pulls in every model/router) can't be poisoned by other test modules'
os.environ mutations, and vice versa.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from app.core.config import Settings

BACKEND_ROOT = Path(__file__).resolve().parents[1]

_INSPECT = """
import json
from app.main import app
cors = next(m for m in app.user_middleware if m.cls.__name__ == "CORSMiddleware")
print(json.dumps({
    "allow_origin_regex": cors.kwargs.get("allow_origin_regex"),
    "allow_origins": cors.kwargs.get("allow_origins"),
}))
"""


def _prod_settings(**overrides) -> Settings:
    base = dict(
        DATABASE_URL="postgresql://u:p@db.example.com/x",
        REDIS_URL="redis://r",
        JWT_SECRET_KEY="x" * 40,
        GOOGLE_CLIENT_ID="c",
        ENVIRONMENT="production",
        CORS_PRODUCTION_ORIGINS="https://sportyyy.tech",
        FRONTEND_BASE_URL="https://sportyyy.tech",
    )
    return Settings(_env_file=None, **{**base, **overrides})


def test_app_cors_has_no_origin_regex():
    result = subprocess.run(
        [sys.executable, "-c", _INSPECT],
        cwd=BACKEND_ROOT,
        env={
            "PATH": "/usr/bin:/bin",
            "DATABASE_URL": "postgresql://u:p@localhost:5/x",
            "REDIS_URL": "redis://localhost:6379/0",
            "JWT_SECRET_KEY": "x" * 32,
            "GOOGLE_CLIENT_ID": "test-client",
            "SENTRY_DSN": "",
        },
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert result.returncode == 0, result.stderr
    cors = json.loads(result.stdout.strip().splitlines()[-1])
    assert cors["allow_origin_regex"] is None
    assert cors["allow_origins"], "expected an explicit origin allowlist"
    assert not any("vercel.app" in o for o in cors["allow_origins"])


def test_production_origins_are_exactly_the_env_list():
    origins = _prod_settings().get_cors_origins()
    assert origins == ["https://sportyyy.tech"]


def test_production_refuses_to_boot_without_origins():
    import pytest

    with pytest.raises(ValueError, match="CORS_PRODUCTION_ORIGINS"):
        _prod_settings(CORS_PRODUCTION_ORIGINS="").get_cors_origins()

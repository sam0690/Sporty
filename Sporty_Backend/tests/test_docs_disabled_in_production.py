"""Interactive docs must not be served in production.

/docs, /redoc and /openapi.json are a complete map of the API — every route,
every schema, every parameter — handed to anyone who asks, and they sit on the
CSRF exempt list.

Booted in a subprocess for the same reason test_cors_pin.py does it: docs_url is
evaluated at import time from settings, and several test modules mutate
os.environ at import, so an in-process import of app.main can be poisoned by
collection order (and would poison others in turn).
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]

_INSPECT = """
import json
from app.main import app
print(json.dumps({
    "docs_url": app.docs_url,
    "redoc_url": app.redoc_url,
    "openapi_url": app.openapi_url,
}))
"""

_BASE_ENV = {
    "PATH": "/usr/bin:/bin",
    "REDIS_URL": "redis://localhost:6379/0",
    "JWT_SECRET_KEY": "x" * 32,
    "GOOGLE_CLIENT_ID": "test-client",
    "SENTRY_DSN": "",
}


def _boot(**env) -> dict:
    result = subprocess.run(
        [sys.executable, "-c", _INSPECT],
        cwd=BACKEND_ROOT,
        env={**_BASE_ENV, **env},
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout.strip().splitlines()[-1])


def test_docs_are_closed_in_production():
    urls = _boot(
        ENVIRONMENT="production",
        DATABASE_URL="postgresql://u:p@db.example.com/x",
        CORS_PRODUCTION_ORIGINS="https://sportyyy.tech",
        FRONTEND_BASE_URL="https://sportyyy.tech",
        COOKIE_SECURE="True",
        COOKIE_SAME_SITE="lax",
        COOKIE_DOMAIN=".sportyyy.tech",
    )
    assert urls == {"docs_url": None, "redoc_url": None, "openapi_url": None}


def test_docs_stay_open_in_development():
    urls = _boot(
        ENVIRONMENT="development",
        DATABASE_URL="postgresql://u:p@localhost:5/x",
    )
    assert urls["docs_url"] == "/docs"
    assert urls["openapi_url"] == "/openapi.json"

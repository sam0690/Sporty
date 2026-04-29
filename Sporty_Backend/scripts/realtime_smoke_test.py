"""Realtime pipeline smoke test.

Checks:
1) API /health and /metrics
2) Kafka and Redis import availability in current env
3) Core realtime modules import successfully

Run:
    /home/sam069/projects/Sporty/.venv/bin/python scripts/realtime_smoke_test.py
"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

import httpx


def _ok(message: str) -> None:
    print(f"[OK] {message}")


def _warn(message: str) -> None:
    print(f"[WARN] {message}")


def _fail(message: str) -> None:
    print(f"[FAIL] {message}")


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(root))

    for module_name in (
        "aiokafka",
        "redis.asyncio",
        "app.core.kafka",
        "app.services.match_scheduler",
        "app.consumers.points_engine",
        "app.consumers.normalizer",
        "app.consumers.notifications",
    ):
        try:
            importlib.import_module(module_name)
            _ok(f"Imported {module_name}")
        except Exception as exc:
            _fail(f"Failed importing {module_name}: {exc}")
            return 1

    api_base = "http://localhost:8000"
    with httpx.Client(timeout=5.0) as client:
        try:
            health = client.get(f"{api_base}/health")
            if health.status_code == 200:
                _ok("API /health reachable")
            else:
                _warn(f"API /health returned status {health.status_code}")
        except Exception as exc:
            _warn(f"API /health not reachable: {exc}")

        try:
            metrics = client.get(f"{api_base}/metrics")
            if metrics.status_code == 200:
                _ok("API /metrics reachable")
            else:
                _warn(f"API /metrics returned status {metrics.status_code}")
        except Exception as exc:
            _warn(f"API /metrics not reachable: {exc}")

    _ok("Realtime smoke test completed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

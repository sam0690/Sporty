"""/metrics must not be public.

It publishes per-route request counts and latency histograms — simultaneously a
map of which endpoints exist and a live read on how much real traffic this runs
at. Gated by X-Metrics-Token, same shape as the feeder's X-Feeder-Secret.
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.core import metrics


def _call(monkeypatch, *, token: str, environment: str, header: str | None):
    monkeypatch.setattr(metrics.settings, "METRICS_TOKEN", token, raising=False)
    monkeypatch.setattr(metrics.settings, "ENVIRONMENT", environment, raising=False)
    return metrics.require_metrics_token(x_metrics_token=header)


def test_correct_token_is_accepted(monkeypatch):
    assert _call(monkeypatch, token="s3cret", environment="production", header="s3cret") is None


def test_missing_header_is_rejected(monkeypatch):
    with pytest.raises(HTTPException) as exc:
        _call(monkeypatch, token="s3cret", environment="production", header=None)
    assert exc.value.status_code == 401


def test_wrong_token_is_rejected(monkeypatch):
    with pytest.raises(HTTPException) as exc:
        _call(monkeypatch, token="s3cret", environment="production", header="wrong")
    assert exc.value.status_code == 401


def test_unset_token_closes_the_endpoint_in_production(monkeypatch):
    """An unconfigured token must close /metrics, not leave it open.

    503 rather than a validate_production() boot failure: forgetting this env
    var should cost you metrics, not the whole API.
    """
    with pytest.raises(HTTPException) as exc:
        _call(monkeypatch, token="", environment="production", header=None)
    assert exc.value.status_code == 503


def test_unset_token_leaves_it_open_in_development(monkeypatch):
    assert _call(monkeypatch, token="", environment="development", header=None) is None


def test_metrics_route_carries_the_dependency():
    """Pins the wiring, not just the function — expose() forwards **kwargs to
    app.get(), and a silent signature change there would drop the gate."""
    from fastapi import Depends
    from fastapi.routing import APIRoute
    from prometheus_fastapi_instrumentator import Instrumentator
    from fastapi import FastAPI

    app = FastAPI()
    Instrumentator().instrument(app).expose(
        app,
        endpoint="/metrics",
        include_in_schema=False,
        dependencies=[Depends(metrics.require_metrics_token)],
    )

    route = next(r for r in app.routes if isinstance(r, APIRoute) and r.path == "/metrics")
    assert any(
        d.dependency is metrics.require_metrics_token for d in route.dependencies
    ), "expose() dropped the auth dependency"

"""Prometheus metrics registry for realtime pipeline instrumentation."""

from __future__ import annotations

import secrets

from fastapi import Header, HTTPException
from prometheus_client import Counter, Gauge, Histogram

from app.core.config import settings

ingestion_polls_total = Counter(
    "sporty_ingestion_polls_total",
    "Total ingestion polling attempts by sport and status",
    ["sport", "status"],
)

ingestion_poll_duration_seconds = Histogram(
    "sporty_ingestion_poll_duration_seconds",
    "Ingestion polling loop duration by sport",
    ["sport"],
)

realtime_retry_total = Counter(
    "sporty_realtime_retry_total",
    "Retry attempts across realtime components",
    ["component", "operation"],
)

realtime_retry_exhausted_total = Counter(
    "sporty_realtime_retry_exhausted_total",
    "Retries exhausted across realtime components",
    ["component", "operation"],
)

points_events_processed_total = Counter(
    "sporty_points_events_processed_total",
    "Processed events in points engine",
    ["status"],
)

consumer_errors_total = Counter(
    "sporty_consumer_errors_total",
    "Realtime consumer error count",
    ["consumer"],
)

ws_active_connections = Gauge(
    "sporty_ws_active_connections",
    "Active websocket connections",
    ["channel_type"],
)

ws_messages_sent_total = Counter(
    "sporty_ws_messages_sent_total",
    "Messages sent over websocket channels",
    ["channel_type"],
)

# ── Per-request DB + cache instrumentation (perf audit, 2026-07) ──────────────
# HTTP P50-P99 latency already comes from prometheus_fastapi_instrumentator;
# these fill the gap it can't see: how much of a request is SQL, and cache hit
# ratio. Wired via SQLAlchemy events in app/database.py + cache_get in core/redis.
db_query_duration_seconds = Histogram(
    "sporty_db_query_duration_seconds",
    "Duration of a single SQL statement",
)

db_queries_per_request = Histogram(
    "sporty_db_queries_per_request",
    "Number of SQL statements executed while serving one HTTP request",
    buckets=(1, 2, 5, 10, 20, 50, 100, 200),
)

cache_ops_total = Counter(
    "sporty_cache_ops_total",
    "Redis read-cache lookups by cache namespace and outcome",
    # `cache` is the key's prefix (league_read | player_read | reference |
    # api-football | …), derived in cache_get. Without it this is a single
    # blended hit ratio across every cache in the app, which tells you nothing
    # about which one is actually working.
    ["cache", "result"],  # result: hit | miss
)


# ── /metrics endpoint auth ────────────────────────────────────────────────────
# Lives here rather than in main.py so it can be imported (and tested) without
# pulling in every model and router.

def require_metrics_token(
    x_metrics_token: str | None = Header(default=None, alias="X-Metrics-Token"),
) -> None:
    """Gate /metrics behind a shared secret — same shape as X-Feeder-Secret.

    /metrics was public. It publishes per-route request counts and latency
    histograms, which is both a map of which endpoints exist and a live read on
    how much real traffic this serves.

    compare_digest, not ==, so a wrong token costs the same time as a right one
    and can't be recovered a byte at a time.
    """
    expected = settings.METRICS_TOKEN
    if not expected:
        if settings.ENVIRONMENT == "production":
            # 503, not a validate_production() boot failure: an unset token
            # should close the endpoint, not refuse to start the API.
            raise HTTPException(status_code=503, detail="Metrics endpoint is not configured")
        return  # development — nothing to configure, leave it open

    if not x_metrics_token or not secrets.compare_digest(x_metrics_token, expected):
        raise HTTPException(status_code=401, detail="Invalid metrics token")

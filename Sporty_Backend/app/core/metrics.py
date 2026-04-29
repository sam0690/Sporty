"""Prometheus metrics registry for realtime pipeline instrumentation."""

from __future__ import annotations

from prometheus_client import Counter, Gauge, Histogram

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

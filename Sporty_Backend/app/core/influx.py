"""Async InfluxDB helpers for realtime event ingestion."""

from __future__ import annotations

from influxdb_client import Point
from influxdb_client.client.influxdb_client_async import InfluxDBClientAsync

from app.core.config import settings


async def create_influx_client() -> InfluxDBClientAsync:
    return InfluxDBClientAsync(
        url=settings.INFLUXDB_URL,
        token=settings.INFLUXDB_TOKEN,
        org=settings.INFLUXDB_ORG,
    )


async def write_stat_point(
    client: InfluxDBClientAsync,
    *,
    measurement: str,
    tags: dict[str, str],
    fields: dict[str, float | int | str],
    timestamp_ms: int,
) -> None:
    point = Point(measurement)
    for key, value in tags.items():
        point.tag(key, value)
    for key, value in fields.items():
        point.field(key, value)

    write_api = client.write_api()
    await write_api.write(
        bucket=settings.INFLUXDB_BUCKET,
        org=settings.INFLUXDB_ORG,
        record=point.time(timestamp_ms * 1_000_000),
    )

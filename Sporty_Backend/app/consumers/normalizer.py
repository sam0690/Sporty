from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import text

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.influx import create_influx_client, write_stat_point
from app.core.kafka import create_consumer
from app.core.metrics import consumer_errors_total
from app.core.redis import close_async_redis, get_async_redis
from app.models.schemas.events import NormalizedEvent

logger = logging.getLogger(__name__)


async def _is_duplicate(match_id: str, event_id: str) -> bool:
    redis = await get_async_redis()
    key = f"dedup:{match_id}:{event_id}"
    inserted = await redis.set(key, "1", nx=True, ex=60 * 60 * 24)
    return not bool(inserted)


async def run() -> None:
    consumer = await create_consumer(settings.MATCH_EVENTS_TOPIC, group_id="normalizer")
    influx = await create_influx_client()

    try:
        async for msg in consumer:
            try:
                event = NormalizedEvent.model_validate(msg.value)
            except Exception:
                consumer_errors_total.labels("normalizer").inc()
                logger.exception("Invalid event payload on normalizer stream")
                continue

            if await _is_duplicate(event.match_id, event.event_id):
                continue

            event_time = datetime.fromtimestamp(event.ts / 1000, tz=UTC)

            async with AsyncSessionLocal() as db:
                try:
                    await db.execute(
                        text(
                            """
                            INSERT INTO live_events
                              (id, match_id, event_id, sport, event_type, player_id, team_id, value, meta, ts)
                            VALUES
                                                            (:id, :match_id, :event_id, :sport, :event_type, :player_id, :team_id, :value, CAST(:meta AS jsonb), :ts)
                            ON CONFLICT (match_id, event_id) DO NOTHING
                            """
                        ),
                        {
                            "id": str(uuid.uuid4()),
                            "match_id": event.match_id,
                            "event_id": event.event_id,
                            "sport": event.sport.value,
                            "event_type": event.event_type.value,
                            "player_id": event.player_id,
                            "team_id": event.team_id,
                            "value": event.value,
                            "meta": json.dumps(event.meta),
                            "ts": event_time,
                        },
                    )
                    await db.commit()
                except Exception:
                    await db.rollback()
                    consumer_errors_total.labels("normalizer").inc()
                    logger.exception(
                        "Failed to persist canonical event match_id=%s event_id=%s",
                        event.match_id,
                        event.event_id,
                    )
                    continue

            try:
                await write_stat_point(
                    influx,
                    measurement="live_events",
                    tags={
                        "match_id": event.match_id,
                        "sport": event.sport.value,
                        "event_type": event.event_type.value,
                    },
                    fields={
                        "value": event.value,
                        "player_id": event.player_id,
                        "team_id": event.team_id,
                    },
                    timestamp_ms=event.ts,
                )
            except Exception:
                consumer_errors_total.labels("normalizer").inc()
                logger.exception(
                    "Failed writing event to Influx match_id=%s event_id=%s",
                    event.match_id,
                    event.event_id,
                )

    finally:
        await consumer.stop()
        await close_async_redis()
        await influx.close()


if __name__ == "__main__":
    asyncio.run(run())

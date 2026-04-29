from __future__ import annotations

import asyncio
import logging

from pydantic import BaseModel

from app.core.config import settings
from app.core.kafka import create_consumer
from app.core.metrics import consumer_errors_total
from app.core.redis import close_async_redis, get_async_redis
from app.models.schemas.events import WSMessage
from app.services.push_notifications import send_apns, send_fcm

logger = logging.getLogger(__name__)


class NotificationEvent(BaseModel):
    match_id: str
    title: str
    body: str
    data: dict[str, str | int | float | bool | None] = {}
    fcm_token: str | None = None
    apns_token: str | None = None


async def run() -> None:
    consumer = await create_consumer(settings.NOTIFICATIONS_TOPIC, group_id="notifications")
    redis = await get_async_redis()

    try:
        async for msg in consumer:
            try:
                event = NotificationEvent.model_validate(msg.value)
            except Exception:
                consumer_errors_total.labels("notifications").inc()
                logger.exception("Invalid notification payload")
                continue

            if event.fcm_token:
                await send_fcm(event.fcm_token, event.title, event.body, {k: str(v) for k, v in event.data.items()})

            if event.apns_token:
                await send_apns(event.apns_token, event.title, event.body, dict(event.data))

            ws_message = WSMessage(
                event="MATCH_EVENT",
                data={
                    **event.model_dump(),
                    "trace_id": event.data.get("trace_id"),
                },
            )
            try:
                await redis.publish(
                    f"{settings.REDIS_PUBSUB_PREFIX}:{event.match_id}",
                    ws_message.model_dump_json(),
                )
            except Exception:
                consumer_errors_total.labels("notifications").inc()
                logger.exception("Failed to publish in-app notification fanout")

    finally:
        await consumer.stop()
        await close_async_redis()


if __name__ == "__main__":
    asyncio.run(run())

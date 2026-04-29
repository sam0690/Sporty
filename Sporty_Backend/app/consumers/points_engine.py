from __future__ import annotations

import asyncio
import logging
import uuid

from app.core.config import settings
from app.core.kafka import create_consumer, create_producer
from app.core.metrics import (
    consumer_errors_total,
    points_events_processed_total,
    realtime_retry_exhausted_total,
    realtime_retry_total,
)
from app.core.redis import close_async_redis, get_async_redis
from app.models.schemas.events import FantasyPointsDelta, NormalizedEvent, WSMessage
from app.scoring.rules import POINTS_RULES

logger = logging.getLogger(__name__)


def _milestone_for_event(event: NormalizedEvent) -> str | None:
    if event.sport.value == "football" and event.event_type.value == "GOAL":
        if event.meta.get("detail") == "Hat Trick":
            return "hat-trick"

    if event.sport.value == "cricket" and event.event_type.value == "STAT":
        runs = int(event.meta.get("runs", 0) or 0)
        if runs >= 100:
            return "century"

    if event.sport.value == "basketball" and event.event_type.value == "STAT":
        points = int(event.meta.get("points", 0) or 0)
        rebounds = int(event.meta.get("rebounds", 0) or 0)
        assists = int(event.meta.get("assists", 0) or 0)
        if points >= 10 and rebounds >= 10 and assists >= 10:
            return "triple-double"

    return None


async def _publish_leaderboard_delta(redis, *, match_id: str, ts: int, player_id: str) -> None:
    keys = await redis.keys(f"fantasy:match:{match_id}:player:*")
    points_by_player: list[tuple[str, float]] = []
    for key in keys:
        pid = key.rsplit(":", 1)[-1]
        raw = await redis.hget(key, "points")
        if raw is None:
            continue
        points_by_player.append((pid, float(raw)))

    ranked = sorted(points_by_player, key=lambda item: (-item[1], item[0]))
    rank = None
    top_rows = []
    for idx, (pid, points) in enumerate(ranked, start=1):
        if pid == player_id:
            rank = idx
        if idx <= 10:
            top_rows.append({"player_id": pid, "points": points, "rank": idx})

    await redis.publish(
        f"leaderboard:{match_id}",
        WSMessage(
            event="MATCH_EVENT",
            data={
                "kind": "LEADERBOARD_DELTA",
                "match_id": match_id,
                "player_id": player_id,
                "rank": rank,
                "top": top_rows,
                "ts": ts,
            },
        ).model_dump_json(),
    )


async def run() -> None:
    consumer = await create_consumer(
        settings.MATCH_EVENTS_TOPIC,
        settings.PLAYER_STATS_TOPIC,
        group_id="points-engine",
    )
    producer = await create_producer()
    redis = await get_async_redis()

    try:
        async for msg in consumer:
            try:
                event = NormalizedEvent.model_validate(msg.value)
            except Exception:
                logger.exception("Invalid event payload on points-engine stream")
                points_events_processed_total.labels("invalid").inc()
                continue

            trace_id = str(event.meta.get("trace_id") or uuid.uuid4())

            dedup_key = f"points:dedup:{event.match_id}:{event.event_id}"
            first_seen = await redis.set(dedup_key, "1", nx=True, ex=60 * 60 * 24)
            if not first_seen:
                points_events_processed_total.labels("duplicate").inc()
                continue

            sport_rules = POINTS_RULES.get(event.sport, {})
            rule = sport_rules.get(event.event_type)
            if not rule:
                points_events_processed_total.labels("skipped_no_rule").inc()
                continue

            delta = float(rule(event))
            if delta == 0.0:
                points_events_processed_total.labels("skipped_zero_delta").inc()
                continue

            redis_key = f"fantasy:match:{event.match_id}:player:{event.player_id}"
            try:
                new_total = await redis.hincrbyfloat(redis_key, "points", delta)
            except Exception:
                consumer_errors_total.labels("points-engine").inc()
                logger.exception("Redis hincrbyfloat failed in points engine")
                continue

            payload = FantasyPointsDelta(
                match_id=event.match_id,
                player_id=event.player_id,
                delta=delta,
                total_points=float(new_total),
                ts=event.ts,
            )
            ws_message = WSMessage(
                event="FANTASY_POINTS_DELTA",
                data=payload.model_dump(),
            )
            ws_payload = ws_message.model_dump()
            ws_payload["data"]["trace_id"] = trace_id
            await _publish_with_retry(
                redis,
                channel=f"{settings.REDIS_PUBSUB_PREFIX}:{event.match_id}",
                message=WSMessage(event=ws_payload["event"], data=ws_payload["data"]).model_dump_json(),
                component="points-engine",
                operation="redis-publish-match",
            )
            await _publish_leaderboard_delta(
                redis,
                match_id=event.match_id,
                ts=event.ts,
                player_id=event.player_id,
            )

            fantasy_payload = payload.model_dump(mode="json")
            fantasy_payload["trace_id"] = trace_id
            await _send_kafka_with_retry(
                producer,
                topic=settings.FANTASY_POINTS_TOPIC,
                key=event.match_id.encode("utf-8"),
                value=fantasy_payload,
                component="points-engine",
                operation="kafka-send-fantasy",
            )

            milestone = _milestone_for_event(event)
            if milestone:
                await _send_kafka_with_retry(
                    producer,
                    topic=settings.NOTIFICATIONS_TOPIC,
                    key=event.match_id.encode("utf-8"),
                    value={
                        "match_id": event.match_id,
                        "title": "Fantasy milestone",
                        "body": f"{milestone} achieved",
                        "data": {
                            "player_id": event.player_id,
                            "milestone": milestone,
                            "event_id": event.event_id,
                            "trace_id": trace_id,
                        },
                    },
                    component="points-engine",
                    operation="kafka-send-notification",
                )

            points_events_processed_total.labels("ok").inc()

    finally:
        await consumer.stop()
        await producer.stop()
        await close_async_redis()


if __name__ == "__main__":
    asyncio.run(run())


async def _publish_with_retry(redis, *, channel: str, message: str, component: str, operation: str) -> None:
    attempts = 3
    for attempt in range(1, attempts + 1):
        try:
            await redis.publish(channel, message)
            return
        except Exception:
            if attempt >= attempts:
                realtime_retry_exhausted_total.labels(component, operation).inc()
                raise
            realtime_retry_total.labels(component, operation).inc()
            await asyncio.sleep(0.15 * (2 ** (attempt - 1)))


async def _send_kafka_with_retry(producer, *, topic: str, key: bytes, value: dict, component: str, operation: str) -> None:
    attempts = 3
    for attempt in range(1, attempts + 1):
        try:
            await producer.send_and_wait(topic, key=key, value=value)
            return
        except Exception:
            if attempt >= attempts:
                realtime_retry_exhausted_total.labels(component, operation).inc()
                raise
            realtime_retry_total.labels(component, operation).inc()
            await asyncio.sleep(0.15 * (2 ** (attempt - 1)))

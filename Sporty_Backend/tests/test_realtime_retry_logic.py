from __future__ import annotations

import asyncio

from app.consumers.points_engine import _publish_with_retry, _send_kafka_with_retry
from app.services.ingestion_worker import IngestionWorker


class _FlakyProducer:
    def __init__(self, fail_times: int):
        self.fail_times = fail_times
        self.calls = 0

    async def send_and_wait(self, topic: str, key: bytes, value: dict):
        _ = (topic, key, value)
        self.calls += 1
        if self.calls <= self.fail_times:
            raise RuntimeError("transient kafka error")


class _FlakyRedis:
    def __init__(self, fail_times: int):
        self.fail_times = fail_times
        self.calls = 0

    async def publish(self, channel: str, message: str):
        _ = (channel, message)
        self.calls += 1
        if self.calls <= self.fail_times:
            raise RuntimeError("transient redis error")


class _Adapter:
    sport = "football"

    async def poll(self, match_id: str):
        _ = match_id
        return []

    def normalize(self, raw):
        return raw


def test_ingestion_worker_send_with_retry_eventually_succeeds():
    async def _run():
        producer = _FlakyProducer(fail_times=2)
        worker = IngestionWorker(adapter=_Adapter(), match_id="m1", producer=producer)
        await worker._send_with_retry({"k": "v"})
        assert producer.calls == 3

    asyncio.run(_run())


def test_points_engine_kafka_retry_eventually_succeeds():
    async def _run():
        producer = _FlakyProducer(fail_times=2)
        await _send_kafka_with_retry(
            producer,
            topic="fantasy.points",
            key=b"m1",
            value={"x": 1},
            component="points-engine",
            operation="kafka-send-fantasy",
        )
        assert producer.calls == 3

    asyncio.run(_run())


def test_points_engine_redis_retry_eventually_succeeds():
    async def _run():
        redis = _FlakyRedis(fail_times=1)
        await _publish_with_retry(
            redis,
            channel="match:m1",
            message="{}",
            component="points-engine",
            operation="redis-publish-match",
        )
        assert redis.calls == 2

    asyncio.run(_run())

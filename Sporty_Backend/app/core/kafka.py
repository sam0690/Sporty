"""Kafka producer/consumer helpers for realtime event pipeline."""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any

from app.core.config import settings

if TYPE_CHECKING:
    from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
else:
    AIOKafkaConsumer = Any
    AIOKafkaProducer = Any


def _bootstrap_servers() -> list[str]:
    return [item.strip() for item in settings.KAFKA_BOOTSTRAP_SERVERS.split(",") if item.strip()]


async def create_producer() -> AIOKafkaProducer:
    from aiokafka import AIOKafkaProducer as KafkaProducer

    producer = KafkaProducer(
        bootstrap_servers=_bootstrap_servers(),
        client_id=settings.KAFKA_CLIENT_ID,
        security_protocol=settings.KAFKA_SECURITY_PROTOCOL,
        value_serializer=lambda value: json.dumps(value).encode("utf-8"),
    )
    await producer.start()
    return producer


async def create_consumer(*topics: str, group_id: str) -> AIOKafkaConsumer:
    from aiokafka import AIOKafkaConsumer as KafkaConsumer

    consumer = KafkaConsumer(
        *topics,
        bootstrap_servers=_bootstrap_servers(),
        group_id=group_id,
        security_protocol=settings.KAFKA_SECURITY_PROTOCOL,
        value_deserializer=lambda data: json.loads(data.decode("utf-8")),
        enable_auto_commit=True,
        auto_offset_reset="latest",
    )
    await consumer.start()
    return consumer

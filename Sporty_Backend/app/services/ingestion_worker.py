from __future__ import annotations

import asyncio
import logging
import time
import uuid
from typing import TYPE_CHECKING, Any

from app.adapters.base import ISportAdapter
from app.core.config import settings
from app.core.metrics import (
    ingestion_poll_duration_seconds,
    ingestion_polls_total,
    realtime_retry_exhausted_total,
    realtime_retry_total,
)

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from aiokafka import AIOKafkaProducer
else:
    AIOKafkaProducer = Any


class IngestionWorker:
    def __init__(self, adapter: ISportAdapter, match_id: str, producer: AIOKafkaProducer):
        self.adapter = adapter
        self.match_id = match_id
        self.producer = producer
        self._task: asyncio.Task | None = None
        self._running = False

    async def start(self) -> None:
        if self._task and not self._task.done():
            return
        self._running = True
        self._task = asyncio.create_task(self._loop(), name=f"ingestion:{self.adapter.sport}:{self.match_id}")

    async def stop(self) -> None:
        self._running = False
        if self._task is None:
            return
        self._task.cancel()
        try:
            await self._task
        except asyncio.CancelledError:
            pass

    async def _loop(self) -> None:
        interval = max(float(settings.INGEST_POLL_INTERVAL_SECONDS), 1.0)

        while self._running:
            started = time.perf_counter()
            try:
                raw_events = await self.adapter.poll(self.match_id)
                for raw in raw_events:
                    payload = dict(raw.payload)
                    payload.setdefault("trace_id", str(uuid.uuid4()))
                    raw.payload = payload
                    event = self.adapter.normalize(raw)
                    await self._send_with_retry(event.model_dump(mode="json"))

                ingestion_polls_total.labels(self.adapter.sport, "ok").inc()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception(
                    "Ingestion loop failed for sport=%s match_id=%s",
                    self.adapter.sport,
                    self.match_id,
                )
                ingestion_polls_total.labels(self.adapter.sport, "error").inc()
            finally:
                ingestion_poll_duration_seconds.labels(self.adapter.sport).observe(
                    time.perf_counter() - started
                )

            await asyncio.sleep(interval)

    async def _send_with_retry(self, value: dict) -> None:
        attempts = 3
        for attempt in range(1, attempts + 1):
            try:
                await self.producer.send_and_wait(
                    settings.MATCH_EVENTS_TOPIC,
                    key=self.match_id.encode("utf-8"),
                    value=value,
                )
                return
            except Exception:
                if attempt >= attempts:
                    realtime_retry_exhausted_total.labels("ingestion-worker", "kafka-send").inc()
                    raise
                realtime_retry_total.labels("ingestion-worker", "kafka-send").inc()
                await asyncio.sleep(0.15 * (2 ** (attempt - 1)))

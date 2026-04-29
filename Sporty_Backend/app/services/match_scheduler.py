from __future__ import annotations

import asyncio
import logging
from typing import Any

from sqlalchemy import select

from app.adapters.registry import ADAPTER_REGISTRY
from app.core.database import AsyncSessionLocal
from app.league.models import Sport
from app.match.models import Match
from app.services.ingestion_worker import IngestionWorker

logger = logging.getLogger(__name__)

AIOKafkaProducer = Any


class MatchScheduler:
    """Maintains ingestion workers for currently-live matches only."""

    def __init__(self, producer: AIOKafkaProducer, refresh_interval_seconds: float = 10.0):
        self.producer = producer
        self.refresh_interval_seconds = max(refresh_interval_seconds, 2.0)
        self.workers: dict[str, IngestionWorker] = {}
        self._task: asyncio.Task | None = None
        self._running = False

    async def start(self) -> None:
        if self._task and not self._task.done():
            return
        self._running = True
        self._task = asyncio.create_task(self._run(), name="match-scheduler")

    async def stop(self) -> None:
        self._running = False
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

        for match_id, worker in list(self.workers.items()):
            await worker.stop()
            self.workers.pop(match_id, None)

    async def _run(self) -> None:
        while self._running:
            try:
                live_matches = await self._fetch_live_matches()
                await self._reconcile_workers(live_matches)
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("MatchScheduler loop failed")

            await asyncio.sleep(self.refresh_interval_seconds)

    async def _fetch_live_matches(self) -> list[tuple[str, str]]:
        async with AsyncSessionLocal() as db:
            stmt = (
                select(Match.external_api_id, Sport.name)
                .join(Sport, Sport.id == Match.sport_id)
                .where(Match.status == "live")
            )
            rows = await db.execute(stmt)
            return [
                (str(external_api_id), sport_name)
                for external_api_id, sport_name in rows.all()
                if external_api_id
            ]

    async def _reconcile_workers(self, live_matches: list[tuple[str, str]]) -> None:
        live_map = {match_id: sport_name for match_id, sport_name in live_matches}

        # Stop workers for matches no longer live
        for match_id in list(self.workers.keys()):
            if match_id in live_map:
                continue
            await self.workers[match_id].stop()
            self.workers.pop(match_id, None)
            logger.info("Stopped ingestion worker for match_id=%s", match_id)

        # Start workers for new live matches
        for match_id, sport_name in live_map.items():
            if match_id in self.workers:
                continue

            adapter = ADAPTER_REGISTRY.get(sport_name)
            if not adapter:
                logger.warning("No adapter registered for sport=%s", sport_name)
                continue

            worker = IngestionWorker(adapter=adapter, match_id=match_id, producer=self.producer)
            await worker.start()
            self.workers[match_id] = worker
            logger.info("Started ingestion worker for sport=%s match_id=%s", sport_name, match_id)

"""Liveness heartbeat for the Kafka consumer processes (app/workers/entry_points.py).

Unlike Celery (which has celery_app.control.inspect() for free), the Kafka
consumers are plain long-running asyncio processes with no built-in status
API — this is the minimal instrumentation needed to answer "is this worker
alive" from an admin endpoint. Each consumer's run() starts this as a
background task; it writes a short-TTL Redis key on an interval independent
of message arrival, so a quiet-but-alive consumer (no messages to process)
doesn't look dead.
"""

from __future__ import annotations

import asyncio
import logging

from app.core.redis import get_async_redis

logger = logging.getLogger(__name__)

HEARTBEAT_TTL_SECONDS = 30
HEARTBEAT_INTERVAL_SECONDS = 15


def heartbeat_key(worker_name: str) -> str:
    return f"heartbeat:worker:{worker_name}"


async def _heartbeat_loop(worker_name: str) -> None:
    key = heartbeat_key(worker_name)
    while True:
        try:
            redis = await get_async_redis()
            await redis.set(key, "1", ex=HEARTBEAT_TTL_SECONDS)
        except Exception:
            logger.exception("Failed to write heartbeat for worker=%s", worker_name)
        await asyncio.sleep(HEARTBEAT_INTERVAL_SECONDS)


def start_heartbeat(worker_name: str) -> asyncio.Task:
    """Start a background heartbeat task for this worker process. The task
    runs for the process's lifetime — no need to cancel it, the process exit
    takes it down too."""
    return asyncio.create_task(_heartbeat_loop(worker_name))

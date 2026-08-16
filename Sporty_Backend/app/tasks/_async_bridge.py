"""Run an async coroutine from a synchronous Celery task.

Previously duplicated verbatim in live_polling_tasks.py and sync_tasks.py, and
both copies carried the same bug: asyncio.run() closes its event loop when it
returns, but app/core/redis.py caches the async client in a MODULE-LEVEL global
(`_async_redis_client`). A long-lived worker process therefore handed the
second task run a client whose connections belong to a dead loop:

    asyncio.run #1: ok
    asyncio.run #2: RuntimeError: Event loop is closed
    asyncio.run #3: ok        # redis-py discarded the broken connection

Intermittent rather than permanent, which is exactly why it went unnoticed —
roughly every other live poll, prediction sync or lineup sync in a given worker
would die partway through. Dropping the cached client while its loop is still
alive makes each run self-contained.
"""

from __future__ import annotations

import asyncio
from typing import Any


def run_async(coro: Any):
    """Execute `coro` on a fresh event loop, releasing loop-bound globals."""

    async def _with_cleanup():
        try:
            return await coro
        finally:
            # Must happen INSIDE the loop that owns the connections.
            from app.core.redis import close_async_redis

            await close_async_redis()

    try:
        return asyncio.run(_with_cleanup())
    except RuntimeError as exc:
        # Defensive fallback if called from an already-running loop.
        if "asyncio.run() cannot be called from a running event loop" not in str(exc):
            raise
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(_with_cleanup())
        finally:
            loop.close()

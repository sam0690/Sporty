"""Live polling Celery tasks.

These run on a tight schedule (e.g., every minute) and should be protected
by Redis locks so only one worker executes them at a time.

Implementation of the live sync services will be filled in later; for now
these tasks call stub services so imports + scheduling work.
"""

from __future__ import annotations

import asyncio
from typing import Any

from celery import shared_task

from app.core.redis_lock import redis_lock
from app.database import SessionLocal
from app.services.sync.cricket_live_sync import sync_cricket_live_matches
from app.services.sync.football_live_sync import sync_football_live_matches
from app.services.sync.nba_live_sync import sync_nba_live_matches


def _run_async(coro: Any):
    try:
        return asyncio.run(coro)
    except RuntimeError as exc:
        if "asyncio.run() cannot be called from a running event loop" not in str(exc):
            raise
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(coro)
        finally:
            loop.close()


@shared_task(name="live.football.poll")
def poll_live_football_task() -> dict[str, Any]:
    lock_key = "lock:live:football:poll"
    with redis_lock(lock_key, ttl_seconds=55) as acquired:
        if not acquired:
            return {"ok": True, "skipped": True, "reason": "lock_held", "task": "live.football.poll"}

        db = SessionLocal()
        try:
            result = _run_async(sync_football_live_matches(db))
            return {"ok": True, "task": "live.football.poll", "result": result}
        finally:
            db.close()


@shared_task(name="live.nba.poll")
def poll_live_nba_task() -> dict[str, Any]:
    lock_key = "lock:live:nba:poll"
    with redis_lock(lock_key, ttl_seconds=55) as acquired:
        if not acquired:
            return {"ok": True, "skipped": True, "reason": "lock_held", "task": "live.nba.poll"}

        db = SessionLocal()
        try:
            result = _run_async(sync_nba_live_matches(db))
            return {"ok": True, "task": "live.nba.poll", "result": result}
        finally:
            db.close()


@shared_task(name="live.cricket.poll")
def poll_live_cricket_task() -> dict[str, Any]:
    lock_key = "lock:live:cricket:poll"
    with redis_lock(lock_key, ttl_seconds=55) as acquired:
        if not acquired:
            return {"ok": True, "skipped": True, "reason": "lock_held", "task": "live.cricket.poll"}

        db = SessionLocal()
        try:
            result = _run_async(sync_cricket_live_matches(db))
            return {"ok": True, "task": "live.cricket.poll", "result": result}
        finally:
            db.close()

"""Celery tasks for scoring (Phase 7).

Tasks:
- score.transfer_window(transfer_window_id)
- score.active_windows()

Both tasks use SessionLocal from app/database.py and are protected by a
Redis distributed lock to avoid overlapping runs.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from celery import shared_task

from app.core.redis_lock import redis_lock
from app.database import SessionLocal
from app.services.scoring.engine import (
    score_active_transfer_windows,
    score_transfer_window_for_season_leagues,
)


@shared_task(name="score.transfer_window")
def score_transfer_window_task(transfer_window_id: str) -> dict[str, Any]:
    """Compute player points + team weekly scores + ranks for a transfer window."""

    tw = UUID(str(transfer_window_id))
    lock_key = f"lock:score:transfer_window:{tw}"

    with redis_lock(lock_key, ttl_seconds=60 * 10) as acquired:
        if not acquired:
            return {"ok": True, "skipped": True, "reason": "lock_held", "task": "score.transfer_window"}

        db = SessionLocal()
        try:
            result = score_transfer_window_for_season_leagues(db, transfer_window_id=tw, commit=True)

            # Best-effort cache invalidation (60s TTL anyway)
            # We don't know league IDs here without re-querying; invalidate by pattern would be ideal
            # but we keep it minimal and delete only the known window keys if callers provide them.
            return {"ok": True, "task": "score.transfer_window", "transfer_window_id": str(tw), **result}
        finally:
            db.close()


@shared_task(name="score.active_windows")
def score_active_windows_task() -> dict[str, Any]:
    """Periodic scorer: scores any currently-active transfer windows."""

    lock_key = "lock:score:active_windows"
    with redis_lock(lock_key, ttl_seconds=60 * 10) as acquired:
        if not acquired:
            return {"ok": True, "skipped": True, "reason": "lock_held", "task": "score.active_windows"}

        db = SessionLocal()
        try:
            result = score_active_transfer_windows(db, commit=True)
            return {"ok": True, "task": "score.active_windows", **result}
        finally:
            db.close()


@shared_task(name="score.active_transfer_windows")
def score_active_transfer_windows_task() -> dict[str, Any]:
    """Alias for score.active_windows (name preferred by docs/spec)."""

    lock_key = "lock:score:active_windows"
    with redis_lock(lock_key, ttl_seconds=60 * 10) as acquired:
        if not acquired:
            return {
                "ok": True,
                "skipped": True,
                "reason": "lock_held",
                "task": "score.active_transfer_windows",
            }

        db = SessionLocal()
        try:
            result = score_active_transfer_windows(db, commit=True)
            return {"ok": True, "task": "score.active_transfer_windows", **result}
        finally:
            db.close()

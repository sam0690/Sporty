"""Celery tasks for dynamic player repricing."""

from __future__ import annotations

from typing import Any

from celery import shared_task

from app.core.redis_lock import redis_lock
from app.database import SessionLocal
from app.services.pricing import recalculate_player_prices


@shared_task(name="pricing.recalculate")
def pricing_recalculate_task(lookback_windows: int = 3) -> dict[str, Any]:
    """Recalculate player prices from recent form.

    Protected by a distributed lock to prevent overlapping recalculations.
    """
    lock_key = f"lock:pricing:recalculate:lookback:{lookback_windows}"
    with redis_lock(lock_key, ttl_seconds=60 * 20) as acquired:
        if not acquired:
            return {
                "ok": True,
                "skipped": True,
                "reason": "lock_held",
                "task": "pricing.recalculate",
            }

        db = SessionLocal()
        try:
            stats = recalculate_player_prices(db, lookback_windows=lookback_windows)
            return {
                "ok": True,
                "task": "pricing.recalculate",
                **stats,
            }
        finally:
            db.close()

from __future__ import annotations

import logging
from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.celery_app import celery_app
from app.core.redis import cache_delete, cache_pattern_delete, get_redis
from app.services.scoring.window_locator import find_transfer_window_ids_for_datetime


logger = logging.getLogger(__name__)


def enqueue_scoring_for_finished_match(
    db: Session,
    *,
    match_date: datetime,
    sport_id: UUID | None = None,
    league_id: UUID | None = None,
    throttle_seconds: int = 300,
) -> int:
    """Enqueue scoring for the transfer window containing match_date.

    Returns the number of tasks enqueued.

    Notes:
    - Uses Celery to enqueue `score.transfer_window(transfer_window_id)`.
    - If multiple windows match (unexpected overlap), enqueues all.
    """

    window_ids = find_transfer_window_ids_for_datetime(db, match_date=match_date, sport_id=sport_id)
    if not window_ids:
        return 0

    redis = get_redis()
    enqueued = 0

    for wid in window_ids:
        # Avoid spamming Celery when sync runs frequently.
        throttle_key = f"score:enqueue:{wid}"
        try:
            acquired = bool(redis.set(throttle_key, "1", nx=True, ex=throttle_seconds))
        except Exception:
            acquired = True

        if not acquired:
            continue

        celery_app.send_task("score.transfer_window", args=[str(wid)])
        enqueued += 1

        # Optional: clear leaderboard cache immediately.
        # If league_id is known, delete the exact key; otherwise clear all leagues for this window.
        if league_id is not None:
            cache_delete(f"leaderboard:{league_id}:{wid}")
        else:
            cache_pattern_delete(f"leaderboard:*:{wid}")

    if enqueued:
        logger.info("Enqueued scoring for %d transfer windows", enqueued)

    return enqueued

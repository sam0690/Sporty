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
    # Algorithm: locate transfer windows containing match_date, enqueue score.transfer_window(window_id), and invalidate leaderboard cache keys for that window.
    window_ids = find_transfer_window_ids_for_datetime(db, match_date=match_date, sport_id=sport_id)
    if not window_ids:
        return 0

    redis = get_redis()
    enqueued = 0

    for window_id in window_ids:
        throttle_key = f"score:enqueue:{window_id}"
        try:
            acquired = bool(redis.set(throttle_key, "1", nx=True, ex=throttle_seconds))
        except Exception:
            acquired = True

        if not acquired:
            continue

        celery_app.send_task("score.transfer_window", args=[str(window_id)])
        enqueued += 1

        if league_id is not None:
            cache_delete(f"leaderboard:{league_id}:{window_id}")
        else:
            cache_pattern_delete(f"leaderboard:*:{window_id}")

    if enqueued:
        logger.info("Enqueued scoring for %d transfer windows", enqueued)

    return enqueued

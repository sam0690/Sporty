from __future__ import annotations

import logging
from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.redis import get_redis
from app.services.scoring.window_locator import find_transfer_window_ids_for_datetime
from app.services.sync.football_competitions import fantasy_tag_for_competition_name


logger = logging.getLogger(__name__)


def enqueue_scoring_for_finished_match(
    db: Session,
    *,
    match_date: datetime,
    sport_id: UUID | None = None,
    league_id: UUID | None = None,
    competition: str | None = None,
    throttle_seconds: int = 300,
) -> int:
    # Algorithm: locate transfer windows containing match_date and enqueue
    # score.transfer_window(window_id) for each. `competition` is the finished
    # match's display name ("Premier League"): passing it skips the sibling
    # competitions' overlapping windows, whose own rollups this match can't
    # change. Omitting it is safe, just wasted work.
    # celery_app is imported lazily: it pulls in the task modules (incl.
    # match_sync, which imports this module at top level), so a module-level
    # import here creates a circular import whenever `trigger` is the entry
    # point (e.g. feed.py's finish handler). Importing it at call time lets
    # `trigger` finish initializing first.
    from app.core.celery_app import celery_app

    window_ids = find_transfer_window_ids_for_datetime(
        db, match_date=match_date, sport_id=sport_id,
        competition_tag=fantasy_tag_for_competition_name(competition),
    )
    if not window_ids:
        logger.warning(
            "No transfer window covers match_date=%s (sport_id=%s) — scoring not enqueued",
            match_date, sport_id,
        )
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

        try:
            # ignore_result=True: this is fire-and-forget, so skip Celery's
            # result-backend round-trip (on_task_call → result_consumer), which
            # otherwise crashes the whole request when the result Redis is
            # unreachable ("Retry limit exceeded ... result store backend").
            celery_app.send_task(
                "score.transfer_window", args=[str(window_id)], ignore_result=True
            )
            enqueued += 1
        except Exception:
            # A broker/result-backend hiccup must not abort the finish handler;
            # the daily ranking cron re-scores the window as a fallback.
            logger.exception("Failed to enqueue scoring for window %s", window_id)
            # Release the throttle so a later attempt can retry sooner.
            try:
                redis.delete(throttle_key)
            except Exception:
                pass
            continue

        # No cache bust here: this runs *before* the enqueued task scores the
        # window, so dropping the leaderboard now just lets the next reader
        # repopulate it with the same stale data. The bust that matters happens
        # after the write, in engine.py / ranking.py.

    if enqueued:
        logger.info("Enqueued scoring for %d transfer windows", enqueued)

    return enqueued

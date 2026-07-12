"""Celery tasks for the live draft room's per-pick timer.

One-off delayed task per turn (send_task(..., countdown=N)) rather than a
Beat-scheduled sweep — pick timers are 15s-10min granularity, too fine for a
cron job, and each turn only ever needs exactly one timeout check.
"""
from __future__ import annotations

import logging
import uuid
from typing import Any, Dict

from fastapi import HTTPException

from app.core.celery_app import celery_app
from app.core.redis_lock import redis_lock
from app.database import SessionLocal
from app.league.models import League, LeagueStatus

logger = logging.getLogger(__name__)


@celery_app.task(name="draft.auto_pick_timeout")
def auto_pick_timeout_task(league_id: str, expected_pick_number: int) -> Dict[str, Any]:
    """Fires `league.draft_pick_seconds` after a pick's deadline was set. If
    nobody picked manually in the meantime, auto-picks for the team on the
    clock and advances the draft to the next turn.

    Idempotent: re-validates the turn is still `expected_pick_number` before
    doing anything, so a manual pick that landed first (or a duplicate task
    delivery) is a silent no-op, not an error.
    """
    db = SessionLocal()
    try:
        league_uuid = uuid.UUID(league_id)
        with redis_lock(f"lock:draft:{league_id}:advance", ttl_seconds=30) as acquired:
            if not acquired:
                return {"skipped": "lock_contended"}

            from app.league import services as league_service

            league = (
                db.query(League)
                .filter(League.id == league_uuid)
                .with_for_update()
                .first()
            )
            if league is None or league.status != LeagueStatus.DRAFTING:
                return {"skipped": "not_drafting"}

            turn = league_service.get_current_draft_turn(db, league_uuid)
            if turn["is_draft_complete"] or turn["next_pick_number"] != expected_pick_number:
                return {"skipped": "turn_already_advanced"}

            team = league_service._require_fantasy_team(db, league_uuid, turn["current_turn_user_id"])
            player = league_service.select_auto_pick_player(db, league_uuid, league, team)
            if player is None:
                logger.error(
                    "Auto-pick found no valid candidate league=%s pick=%s — retrying in 5s",
                    league_id, expected_pick_number,
                )
                celery_app.send_task(
                    "draft.auto_pick_timeout",
                    args=[league_id, expected_pick_number],
                    countdown=5,
                    ignore_result=True,
                )
                return {"retried": True}

            try:
                league_service._execute_draft_pick(
                    db, league_uuid, league, team, player, turn, auto_pick=True,
                )
            except HTTPException as exc:
                if exc.status_code == 409:
                    # A manual pick won the race between our idempotency check
                    # above and acquiring the row lock inside
                    # _execute_draft_pick — benign, not a task failure.
                    db.rollback()
                    return {"skipped": "raced_with_manual_pick"}
                raise

            db.commit()
            league_service._advance_draft_clock(db, league_uuid)
            db.commit()
            return {"auto_picked": str(player.id)}
    except Exception:
        db.rollback()
        logger.exception(
            "Auto-pick timeout task failed league=%s pick=%s", league_id, expected_pick_number,
        )
        raise
    finally:
        db.close()

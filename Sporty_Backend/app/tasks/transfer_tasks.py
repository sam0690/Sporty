"""Celery tasks related to transfer-window lifecycle."""
from __future__ import annotations

from typing import Dict

from app.core.celery_app import celery_app
from app.database import SessionLocal
import logging

logger = logging.getLogger(__name__)


@celery_app.task(name="transfer.auto_lock_expired")
def auto_lock_expired_transfers_task() -> Dict[str, int]:
    """Celery Beat task that auto-locks transfer windows whose deadline passed.

    Returns a small stats dict for observability.
    """
    db = SessionLocal()
    try:
        from app.services.transfer_window_service import auto_lock_expired_transfers

        stats = auto_lock_expired_transfers(db)
        # commit only if any rows changed for clarity; service returns counts
        if stats.get("locked"):
            db.commit()
        else:
            db.rollback()
        logger.info("Celery auto-lock transfers completed: %s", stats)
        return stats
    except Exception:
        db.rollback()
        logger.exception("Celery auto-lock transfers task failed")
        raise
    finally:
        db.close()


@celery_app.task(name="lineup.auto_lock_expired")
def auto_lock_expired_lineups_task() -> Dict[str, int]:
    """Celery Beat task that auto-locks lineup windows whose deadline passed.

    Returns a small stats dict for observability.
    """
    db = SessionLocal()
    try:
        from app.services.transfer_window_service import auto_lock_expired_lineups

        stats = auto_lock_expired_lineups(db)
        # commit only if any rows changed for clarity; service returns counts
        if stats.get("locked"):
            db.commit()
        else:
            db.rollback()
        logger.info("Celery auto-lock lineups completed: %s", stats)
        return stats
    except Exception:
        db.rollback()
        logger.exception("Celery auto-lock lineups task failed")
        raise
    finally:
        db.close()

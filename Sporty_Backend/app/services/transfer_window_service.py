import logging
from datetime import datetime, timezone
from typing import List

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.league.models import TransferWindow

logger = logging.getLogger(__name__)


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def auto_lock_expired_transfers(db: Session) -> dict[str, int]:
    """Find transfer windows whose transfer_deadline_at has passed and set transfers_locked=True.

    Idempotent: only updates windows where transfers_locked is False.
    Returns dict with counts for logging.
    """
    now = _now_utc()
    rows: List[TransferWindow] = (
        db.query(TransferWindow)
        .filter(TransferWindow.transfer_deadline_at <= now, TransferWindow.transfers_locked.is_(False))
        .all()
    )

    if not rows:
        return {"checked": 0, "locked": 0}

    locked = 0
    for w in rows:
        w.transfers_locked = True
        locked += 1
        logger.info("Auto-locking transfers for window=%s season=%s number=%s", w.id, w.season_id, w.number)

    db.flush()
    return {"checked": len(rows), "locked": locked}


def validate_transfer_window_for_transfer(window: TransferWindow) -> None:
    """Raise HTTPException if transfers are not allowed for the provided window."""
    now = _now_utc()
    if window.transfers_locked or now > window.transfer_deadline_at:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Transfers are closed for this window")


def validate_transfer_window_for_lineup(window: TransferWindow) -> None:
    """Raise HTTPException if lineup edits are not allowed for the provided window."""
    now = _now_utc()
    if window.lineup_locked or now > window.lineup_deadline_at:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Lineup is locked for this window")


def auto_lock_expired_lineups(db: Session) -> dict[str, int]:
    """Find transfer windows whose lineup_deadline_at has passed and set lineup_locked=True.

    Idempotent: only updates windows where lineup_locked is False.
    Returns dict with counts for logging.
    """
    now = _now_utc()
    rows: List[TransferWindow] = (
        db.query(TransferWindow)
        .filter(TransferWindow.lineup_deadline_at <= now, TransferWindow.lineup_locked.is_(False))
        .all()
    )

    if not rows:
        return {"checked": 0, "locked": 0}

    locked = 0
    for w in rows:
        w.lineup_locked = True
        locked += 1
        logger.info("Auto-locking lineups for window=%s season=%s number=%s", w.id, w.season_id, w.number)

    db.flush()
    return {"checked": len(rows), "locked": locked}

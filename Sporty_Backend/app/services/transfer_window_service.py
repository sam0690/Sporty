import logging
from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.redis_lock import redis_lock
from app.league.models import Season, TransferWindow

logger = logging.getLogger(__name__)


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _existing_windows_for_season(db: Session, season_id) -> List[TransferWindow]:
    return (
        db.query(TransferWindow)
        .filter(TransferWindow.season_id == season_id)
        .order_by(TransferWindow.number.asc())
        .all()
    )


def generate_transfer_windows_for_season(
    db: Session,
    season: Season,
    transfer_day: int,
) -> List[TransferWindow]:
    """Generate one transfer window per week for a season, admin-triggered.

    Season-scoped, not league-scoped: every league on this season shares the
    resulting windows (see app/league/models.py Season.transfer_windows and
    the note on Season.transfer_day). Superseded League.generate_transfer_windows
    — that function only ever really governed the first league to call it for
    a season, since generation was already idempotent per season_id underneath.

    Idempotency: windows are unique by (season_id, number). If they already
    exist, they're returned unchanged rather than re-inserted.

    Race safety: a Redis lock keyed by season_id avoids two concurrent admin
    calls both doing the full date-walk; the season/transfer_window overlap
    EXCLUDE constraints (see the btree_gist migration) are the authoritative
    guard underneath — a concurrent insert that slips past the lock still
    can't produce duplicate/overlapping rows, it just surfaces as a clean 409
    instead of the raw IntegrityError.

    Does NOT commit — caller owns the transaction.
    """
    if not (1 <= transfer_day <= 7):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="transfer_day must be between 1 and 7",
        )

    existing_windows = _existing_windows_for_season(db, season.id)
    if existing_windows:
        logger.info(
            "Transfer windows already exist for season=%s, reusing %d windows",
            season.id, len(existing_windows),
        )
        return existing_windows

    with redis_lock(
        f"lock:transfer-windows:generate:{season.id}",
        ttl_seconds=30,
        wait_seconds=5.0,
    ) as acquired:
        # Re-check under the lock — another request may have generated the
        # windows while we were waiting to acquire it.
        existing_windows = _existing_windows_for_season(db, season.id)
        if existing_windows:
            return existing_windows

        if not acquired:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Transfer windows are already being generated for this season — try again shortly",
            )

        # Each window is a single day on the designated weekday.
        # transfer_day: 1=Monday..7=Sunday (Python weekday(): Monday=0..Sunday=6).
        current_date = season.start_date
        target_weekday = (transfer_day - 1) % 7

        while current_date.weekday() != target_weekday:
            current_date += timedelta(days=1)
            if current_date > season.end_date:
                break

        window_number = 1
        windows: List[TransferWindow] = []
        while current_date <= season.end_date:
            start_at = datetime.combine(current_date, datetime.min.time()).replace(tzinfo=timezone.utc)
            end_at = start_at + timedelta(hours=23, minutes=59, seconds=59)

            # Deadlines anchored to the START of the gameweek: transfers + lineup
            # lock as the window opens, BEFORE its matches play, so no one can
            # react to live results. (lineup is +1 min so transfer < lineup stays
            # strict.)
            windows.append(TransferWindow(
                season_id=season.id,
                number=window_number,
                start_at=start_at,
                end_at=end_at,
                transfer_deadline_at=start_at,
                lineup_deadline_at=start_at + timedelta(minutes=1),
                transfers_locked=False,
                lineup_locked=False,
            ))

            window_number += 1
            current_date += timedelta(weeks=1)

        if not windows:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No transfer windows could be generated for this season's date range",
            )

        season.transfer_day = transfer_day
        for window in windows:
            db.add(window)

        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Transfer windows were just generated for this season",
            )

        logger.info(
            "Generated %d transfer windows for season=%s (transfer_day=%d)",
            len(windows), season.id, transfer_day,
        )
        return windows


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


def auto_lock_expired_lineups(db: Session) -> tuple[dict[str, int], List[TransferWindow]]:
    """Find transfer windows whose lineup_deadline_at has passed and set lineup_locked=True.

    Idempotent: only updates windows where lineup_locked is False.
    Returns (stats dict for logging, the windows just locked in this call) -
    the caller uses the latter to trigger lineup carry-forward exactly once
    per window, right as it locks (see app/tasks/transfer_tasks.py).
    """
    now = _now_utc()
    rows: List[TransferWindow] = (
        db.query(TransferWindow)
        .filter(TransferWindow.lineup_deadline_at <= now, TransferWindow.lineup_locked.is_(False))
        .all()
    )

    if not rows:
        return {"checked": 0, "locked": 0}, []

    locked = 0
    for w in rows:
        w.lineup_locked = True
        locked += 1
        logger.info("Auto-locking lineups for window=%s season=%s number=%s", w.id, w.season_id, w.number)

    db.flush()
    return {"checked": len(rows), "locked": locked}, rows

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.league.models import Season, TransferWindow


def find_transfer_window_for_datetime(
    db: Session,
    *,
    match_date: datetime,
    sport_id: UUID | None = None,
) -> TransferWindow | None:
    """Find the transfer window covering a given datetime.

    If sport_id is provided, limits to seasons of that sport.
    """

    q = db.query(TransferWindow).join(Season, Season.id == TransferWindow.season_id)
    q = q.filter(TransferWindow.start_at <= match_date, TransferWindow.end_at >= match_date)
    if sport_id is not None:
        q = q.filter(Season.sport_id == sport_id)
    return q.order_by(TransferWindow.start_at.desc()).first()


def find_transfer_window_ids_for_datetime(
    db: Session,
    *,
    match_date: datetime,
    sport_id: UUID | None = None,
) -> list[UUID]:
    """Return all transfer window IDs covering a given datetime."""

    q = db.query(TransferWindow.id).join(Season, Season.id == TransferWindow.season_id)
    q = q.filter(TransferWindow.start_at <= match_date, TransferWindow.end_at >= match_date)
    if sport_id is not None:
        q = q.filter(Season.sport_id == sport_id)

    return [wid for (wid,) in q.all()]

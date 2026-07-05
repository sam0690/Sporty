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

    # Algorithm: select transfer window where start_at <= match_date < end_at.
    q = db.query(TransferWindow).join(Season, Season.id == TransferWindow.season_id)
    q = q.filter(TransferWindow.start_at <= match_date, TransferWindow.end_at > match_date)
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

    # Algorithm: list all transfer window IDs satisfying start_at <= match_date < end_at.
    q = db.query(TransferWindow.id).join(Season, Season.id == TransferWindow.season_id)
    q = q.filter(TransferWindow.start_at <= match_date, TransferWindow.end_at > match_date)
    if sport_id is not None:
        q = q.filter(Season.sport_id == sport_id)

    return [wid for (wid,) in q.all()]


def find_equivalent_window_for_sport(
    db: Session,
    *,
    window: TransferWindow,
    sport_id: UUID,
) -> TransferWindow | None:
    """Translate a window from one sport's schedule to another's.

    A multisport league has a single season_id (one sport's schedule), so a
    mixed squad's lineup rows all carry that one sport's transfer_window_id —
    including for players of the league's OTHER sports. Those other sports
    book their actual PlayerGameweekStat rows under their OWN season's window
    ids, which never equal the lineup's stored id. Rather than requiring exact
    id equality, resolve "the same real-world gameweek" by matching dates:
    same start_at/end_at, different sport. Returns None if that sport has no
    window covering the same date range (e.g. its season hasn't started, or
    ended, or the sport isn't scheduled that week) — callers must treat that
    as "nothing to score for this sport this cycle," not an error.
    """
    if window.season_id and _season_sport_id(db, window.season_id) == sport_id:
        return window

    return (
        db.query(TransferWindow)
        .join(Season, Season.id == TransferWindow.season_id)
        .filter(
            Season.sport_id == sport_id,
            TransferWindow.start_at == window.start_at,
            TransferWindow.end_at == window.end_at,
        )
        .first()
    )


def _season_sport_id(db: Session, season_id: UUID) -> UUID | None:
    return db.query(Season.sport_id).filter(Season.id == season_id).scalar()


def find_equivalent_season_for_sport(
    db: Session,
    *,
    season: Season,
    sport_id: UUID,
) -> Season | None:
    """Season-level counterpart to find_equivalent_window_for_sport.

    A multisport league has one season_id (one sport's schedule). To find
    "the same calendar season" for one of the league's OTHER sports, match on
    start_date/end_date rather than assuming a single season_id applies across
    sports. Matching by date range (not just is_active) also avoids picking
    the wrong season when a sport has more than one is_active row (e.g. next
    year's season already created ahead of time). Returns None if that sport
    has no season covering the same calendar range.
    """
    if season.sport_id == sport_id:
        return season

    return (
        db.query(Season)
        .filter(
            Season.sport_id == sport_id,
            Season.start_date == season.start_date,
            Season.end_date == season.end_date,
        )
        .first()
    )

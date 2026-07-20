from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session

from app.league.models import League, LeagueSport, Season, TransferWindow


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


def _season_sport_id(db: Session, season_id: UUID) -> UUID | None:
    return db.query(Season.sport_id).filter(Season.id == season_id).scalar()


def get_league_sport_season(
    db: Session,
    *,
    league_id: UUID,
    sport_id: UUID,
) -> Season | None:
    """The season of `sport_id` THIS league uses.

    If sport_id is the league's own season's sport, that's unambiguous —
    return it directly, no lookup needed. Otherwise read the explicit,
    deliberate mapping stored on LeagueSport.season_id — set by
    create_league/add_sport, which resolve it (or hard-block league/sport
    creation) rather than ever leaving a persisted row unmapped. See
    app/league/league_service.py. Returns None only for a stale/pre-
    migration row that predates that guarantee, or a league that doesn't
    play this sport at all.

    This is the single source of truth for "which season pairs with which"
    across sports — NOT Season.label (display only) and NOT date equality
    (the old, coincidence-dependent approach this replaces).
    """
    league_row = (
        db.query(League.season_id, Season.sport_id)
        .join(Season, Season.id == League.season_id)
        .filter(League.id == league_id)
        .first()
    )
    if league_row is not None:
        league_season_id, league_season_sport_id = league_row
        # `sport_id is not None` guard is load-bearing: for a UNIFIED-season
        # league `league_season_sport_id` is None, and a bare `== sport_id`
        # comparison would be `None == None` → True whenever a caller passes
        # sport_id=None, wrongly short-circuiting to the unified season instead
        # of resolving the requested real sport via the LeagueSport mapping
        # below. The native-resolution path (engine.score_transfer_window_for_league)
        # is the only caller that ever passed None, and it now handles unified
        # seasons explicitly, so None here means "no such mapping" → fall
        # through (and return None). See docs/UNIFIED_MULTISPORT_SCHEDULE_PLAN.md §3/§7.
        if sport_id is not None and league_season_sport_id == sport_id:
            return db.query(Season).filter(Season.id == league_season_id).first()

    return (
        db.query(Season)
        .join(LeagueSport, LeagueSport.season_id == Season.id)
        .filter(LeagueSport.league_id == league_id, LeagueSport.sport_id == sport_id)
        .first()
    )


def find_equivalent_season_for_sport(
    db: Session,
    *,
    league_id: UUID,
    sport_id: UUID,
) -> Season | None:
    """Thin alias for get_league_sport_season, kept as a separate name for
    callers asking "what season does this league use for this sport" —
    same lookup either way."""
    return get_league_sport_season(db, league_id=league_id, sport_id=sport_id)


def find_equivalent_window_for_sport(
    db: Session,
    *,
    league_id: UUID,
    window: TransferWindow,
    sport_id: UUID,
) -> TransferWindow | None:
    """Translate a window from one sport's schedule to THIS league's
    resolved season for another sport.

    Resolves the league's explicit season mapping for sport_id (see
    get_league_sport_season), then finds whichever window in THAT season
    covers the same point in real time as `window` — a covering-date
    lookup, not an exact start_at/end_at match, since two sports' seasons
    won't share a weekly cadence even once correctly paired (e.g. football
    generating Monday windows vs. a basketball season generating windows on
    a different weekday). Returns None if the league has no resolved season
    for that sport, or that season has no window covering this date —
    callers must treat that as "nothing to score for this sport this
    cycle" only when it's a genuine off-week; a missing season mapping
    itself should already be impossible post-creation (see league_service)
    and callers should log loudly if they hit it (see engine.py).
    """
    if window.season_id and _season_sport_id(db, window.season_id) == sport_id:
        return window

    target_season = get_league_sport_season(db, league_id=league_id, sport_id=sport_id)
    if target_season is None:
        return None

    return (
        db.query(TransferWindow)
        .filter(
            TransferWindow.season_id == target_season.id,
            TransferWindow.start_at <= window.start_at,
            TransferWindow.end_at > window.start_at,
        )
        .order_by(TransferWindow.start_at.desc())
        .first()
    )

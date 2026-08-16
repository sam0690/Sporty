from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.league.models import League, LeagueSport, Season, TransferWindow
from app.match.models import Match
from app.services.sync.football_competitions import competition_names_for_tag


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
    competition_tag: str | None = None,
) -> list[UUID]:
    """Return all transfer window IDs covering a given datetime — the windows a
    match's stats should be booked into.

    competition_tag (football only): when given, a match books ONLY into its
    own competition's window ("EPL"/"LALIGA"/"BUNDESLIGA") AND the combined
    schedule (competition IS NULL) — never into a sibling competition's window
    that happens to overlap the same instant. When None (non-football sports,
    or callers that don't scope), no competition filter is applied — every
    covering window matches, which for single-competition sports is just their
    own NULL windows.

    Inverse of matches_in_window below — the date and competition rules in the
    two must stay in step, or a match's stats and its gameweek rollup disagree.
    """

    # Algorithm: list all transfer window IDs satisfying start_at <= match_date < end_at.
    q = db.query(TransferWindow.id).join(Season, Season.id == TransferWindow.season_id)
    q = q.filter(TransferWindow.start_at <= match_date, TransferWindow.end_at > match_date)
    if sport_id is not None:
        q = q.filter(Season.sport_id == sport_id)
    if competition_tag is not None:
        q = q.filter(
            or_(
                TransferWindow.competition == competition_tag,
                TransferWindow.competition.is_(None),
            )
        )

    return [wid for (wid,) in q.all()]


def matches_in_window(db: Session, window: TransferWindow) -> list[UUID]:
    """Match ids whose stats roll up into `window` — the inverse of
    find_transfer_window_ids_for_datetime.

    Same two rules, read from the window's side: the match starts inside
    [start_at, end_at), and its competition is one the window's schedule covers
    (its own for a per-competition window, every fantasy competition for the
    combined NULL one). Football-shaped, but harmless for other sports: their
    seasons only carry NULL windows and their Match.competition names simply
    aren't in the fantasy list, so callers there keep using the per-window
    stat path instead.
    """
    names = competition_names_for_tag(window.competition)
    if not names:
        return []
    q = (
        db.query(Match.id)
        .filter(
            Match.match_date >= window.start_at,
            Match.match_date < window.end_at,
            Match.competition.in_(names),
        )
    )
    sport_id = _season_sport_id(db, window.season_id)
    if sport_id is not None:
        q = q.filter(Match.sport_id == sport_id)
    return [match_id for (match_id,) in q.all()]


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


def league_competition_filter(
    db: Session,
    *,
    league_id: UUID,
    sport_id: UUID,
) -> str | None:
    """This league's competition_filter for a sport ("EPL"/"LALIGA"/
    "BUNDESLIGA"), or None for an all-competitions league or a
    single-competition sport (basketball/cricket). This is what selects which
    per-competition window schedule the league runs on."""
    return (
        db.query(LeagueSport.competition_filter)
        .filter(LeagueSport.league_id == league_id, LeagueSport.sport_id == sport_id)
        .scalar()
    )


def find_equivalent_window_for_sport(
    db: Session,
    *,
    league_id: UUID,
    window: TransferWindow,
    sport_id: UUID,
) -> TransferWindow | None:
    """The window THIS league runs on for `sport_id` that covers the same
    instant as `window`.

    Resolves the league's season mapping for sport_id (get_league_sport_season)
    AND its competition schedule (league_competition_filter), then finds the
    covering window in that (season, competition) — a covering-date lookup, not
    an exact start/end match, since sibling schedules don't share a cadence.

    The competition filter is load-bearing now that one football season holds
    several overlapping schedules (EPL/LALIGA/BUNDESLIGA gameweeks + the
    combined NULL schedule): without it, several windows cover the same instant
    and the answer would be arbitrary. An EPL-scoped league resolves to the EPL
    window; an all-competitions (filter NULL) league resolves to the combined
    (competition IS NULL) window. A same-sport pass no longer short-circuits —
    it must still be translated to the league's OWN competition schedule.

    Returns None if the league has no resolved season for that sport, or that
    (season, competition) has no window covering this date — callers treat that
    as "nothing to score this cycle" for a genuine off-week, but should log
    loudly for the league's own native sport (see engine.py).
    """
    target_season = get_league_sport_season(db, league_id=league_id, sport_id=sport_id)
    if target_season is None:
        return None

    comp = league_competition_filter(db, league_id=league_id, sport_id=sport_id)
    q = db.query(TransferWindow).filter(
        TransferWindow.season_id == target_season.id,
        TransferWindow.start_at <= window.start_at,
        TransferWindow.end_at > window.start_at,
    )
    q = q.filter(
        TransferWindow.competition.is_(None)
        if comp is None
        else TransferWindow.competition == comp
    )
    return q.order_by(TransferWindow.start_at.desc()).first()

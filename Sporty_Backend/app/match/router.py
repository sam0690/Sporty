"""Match REST router — list fixtures the user is allowed to view.

The realtime routes (`/api/match/{id}/state|prediction|ratings`, websockets)
are keyed by a match id the caller must already know. This list endpoint is
the discovery surface that feeds the frontend Matches/Fixtures page so users
can actually reach the live match view.

Access model: fixtures are a public discovery surface — no auth required.
Match data is never user-specific, so the browse list and the landing-page
blend are both open; users can browse fixtures before (or without) having
an account at all.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import Integer, func
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user
from app.auth.models import User
from app.database import get_db
from app.league.models import Sport
from app.match.models import Match
from app.match.schemas import (
    FDO_MATCH_STATUS,
    FixtureListResponse,
    FixtureResponse,
    MatchListResponse,
    MatchResponse,
)
from app.models.db.live_event import LiveEvent
from app.player.models import RealTeam, UserFavouriteTeam

router = APIRouter(tags=["Matches"])

# Match.home_team/away_team are free-text strings from the external-API sync,
# which don't always agree with RealTeam.name (used elsewhere for crest
# lookups, e.g. the squad/lineup views) — some fixtures use the short form
# ("Newcastle") where RealTeam uses the long form ("Newcastle United"), or
# vice versa. The alias map lives in app.core.team_names so the dataset
# importer and feeder registration share the exact same canonicalisation
# (re-exported here for existing importers).
from app.core.team_names import TEAM_NAME_ALIASES as MATCH_TEAM_NAME_ALIASES
from app.core.redis import LIVE_FAVOURITES_CACHE_KEY, cache_get, cache_set


def _real_team_logo_lookup(db: Session) -> dict[tuple[uuid.UUID, str], str]:
    """(sport_id, team name) -> logo_url for every RealTeam with a logo set.
    Built once per request — RealTeam is a small table (dozens of rows), so
    this is a single cheap query rather than one join per match row."""
    rows = (
        db.query(RealTeam.sport_id, RealTeam.name, RealTeam.logo_url)
        .filter(RealTeam.logo_url.isnot(None))
        .all()
    )
    return {(sport_id, name): logo_url for sport_id, name, logo_url in rows}


def _team_logo_url(
    lookup: dict[tuple[uuid.UUID, str], str], sport_id: uuid.UUID, team_name: str
) -> str | None:
    canonical_name = MATCH_TEAM_NAME_ALIASES.get(team_name, team_name)
    return lookup.get((sport_id, canonical_name))


def _to_match_response(
    match: Match,
    sport_name: str,
    logo_lookup: dict[tuple[uuid.UUID, str], str],
) -> MatchResponse:
    return MatchResponse(
        id=match.id,
        external_api_id=match.external_api_id,
        sport=sport_name,
        home_team=match.home_team,
        away_team=match.away_team,
        home_team_logo_url=_team_logo_url(logo_lookup, match.sport_id, match.home_team),
        away_team_logo_url=_team_logo_url(logo_lookup, match.sport_id, match.away_team),
        match_date=match.match_date,
        status=match.status,
        competition=match.competition,
        home_score=match.home_score,
        away_score=match.away_score,
    )


@router.get(
    "/matches",
    response_model=MatchListResponse,
    summary="List fixtures (public)",
)
def list_matches(
    status: str | None = Query(
        default=None,
        description='Filter by status: "scheduled" | "live" | "finished" | ...',
    ),
    sport_name: str | None = Query(
        default=None, description='Filter by sport slug: "football" | "basketball" | "cricket"'
    ),
    date: str | None = Query(
        default=None, description="Filter to a single calendar day, YYYY-MM-DD (UTC)"
    ),
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
):
    # Public discovery surface — no auth, no league gating (see module docstring).
    query = (
        db.query(Match, Sport.name.label("sport_name"))
        .join(Sport, Match.sport_id == Sport.id)
    )

    if status:
        query = query.filter(Match.status == status.strip().lower())
    if sport_name:
        query = query.filter(Sport.name == sport_name.strip().lower())
    if date:
        try:
            day_start = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            raise HTTPException(status_code=422, detail="date must be in YYYY-MM-DD format")
        query = query.filter(
            Match.match_date >= day_start, Match.match_date < day_start + timedelta(days=1)
        )

    # Most recent / live first; the UI groups by status.
    rows = query.order_by(Match.match_date.desc()).limit(limit).all()

    logo_lookup = _real_team_logo_lookup(db)
    items = [_to_match_response(match, name, logo_lookup) for match, name in rows]
    return MatchListResponse(items=items, total=len(items))


# ── Unified fixtures (fantasy matches + display-only competition snapshots) ──


def _fantasy_to_fixture(match, sport_name, logo_lookup) -> FixtureResponse:
    return FixtureResponse(
        id=str(match.id),
        source="fantasy",
        sport=sport_name,
        competition=match.competition,
        home_team=match.home_team,
        away_team=match.away_team,
        home_team_logo_url=_team_logo_url(logo_lookup, match.sport_id, match.home_team),
        away_team_logo_url=_team_logo_url(logo_lookup, match.sport_id, match.away_team),
        match_date=match.match_date,
        status=match.status,
        home_score=match.home_score,
        away_score=match.away_score,
    )


def _normalize_display_match(m: dict, comp_name: str, comp_tag: str) -> FixtureResponse | None:
    """football-data.org match -> FixtureResponse. Crests come straight from
    the snapshot (CL has clubs outside our leagues, e.g. PSG, so RealTeam
    logos don't cover them)."""
    utc = m.get("utcDate")
    home, away = m.get("homeTeam") or {}, m.get("awayTeam") or {}
    if not utc or not home.get("name") or not away.get("name"):
        return None
    ft = (m.get("score") or {}).get("fullTime") or {}
    return FixtureResponse(
        id=str(m.get("id")),
        source=comp_tag,
        sport="football",
        competition=comp_name,
        home_team=home["name"],
        away_team=away["name"],
        home_team_logo_url=home.get("crest"),
        away_team_logo_url=away.get("crest"),
        match_date=datetime.fromisoformat(utc.replace("Z", "+00:00")),
        status=FDO_MATCH_STATUS.get(m.get("status"), "scheduled"),
        home_score=ft.get("home"),
        away_score=ft.get("away"),
        stage=m.get("stage"),
    )


def _display_fixtures_for_date(db: Session, date_str: str) -> list[FixtureResponse]:
    """Display-only competition (e.g. Champions League) matches on `date_str`,
    read from the cached season snapshots and filtered by kickoff day."""
    from app.models.db.competition_snapshot import CompetitionSnapshot
    from app.services.sync.football_competitions import FOOTBALL_COMPETITIONS

    display = {c.tag: c.name for c in FOOTBALL_COMPETITIONS.values() if not c.fantasy}
    if not display:
        return []
    rows = (
        db.query(CompetitionSnapshot)
        .filter(
            CompetitionSnapshot.competition.in_(list(display)),
            CompetitionSnapshot.kind == "matches",
        )
        .all()
    )
    out: list[FixtureResponse] = []
    for row in rows:
        comp_name = display[row.competition]
        for m in (row.payload or {}).get("matches", []):
            if str(m.get("utcDate") or "")[:10] != date_str:
                continue
            fx = _normalize_display_match(m, comp_name, row.competition)
            if fx is not None:
                out.append(fx)
    return out


def build_fixtures(db: Session, date_str: str, sport_name: str | None) -> list[FixtureResponse]:
    """Fantasy matches + display-only competition matches for one day, merged
    and ordered (live first, then by kickoff). Testable core of GET /fixtures."""
    day_start = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    query = db.query(Match, Sport.name.label("sport_name")).join(Sport, Match.sport_id == Sport.id)
    query = query.filter(
        Match.match_date >= day_start, Match.match_date < day_start + timedelta(days=1)
    )
    if sport_name:
        query = query.filter(Sport.name == sport_name.strip().lower())
    logo_lookup = _real_team_logo_lookup(db)
    fixtures = [_fantasy_to_fixture(m, n, logo_lookup) for m, n in query.all()]

    # Display-only competitions are football; skip when filtered to another sport.
    if not sport_name or sport_name.strip().lower() == "football":
        fixtures += _display_fixtures_for_date(db, date_str)

    # tz-safe: fantasy dates are tz-aware (Postgres) or naive (SQLite tests);
    # display dates are always aware. Treat naive as UTC so the sort never mixes.
    def _key(f: FixtureResponse):
        dt = f.match_date
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return (0 if f.status == "live" else 1, dt)

    fixtures.sort(key=_key)
    return fixtures


@router.get(
    "/fixtures",
    response_model=FixtureListResponse,
    summary="Unified fixtures for a day (fantasy + display-only competitions)",
)
def list_fixtures(
    date: str | None = Query(default=None, description="Calendar day, YYYY-MM-DD (UTC); defaults to today"),
    sport_name: str | None = Query(default=None, description='Filter by sport slug'),
    db: Session = Depends(get_db),
):
    date_str = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=422, detail="date must be in YYYY-MM-DD format")
    fixtures = build_fixtures(db, date_str, sport_name)
    return FixtureListResponse(items=fixtures, total=len(fixtures), date=date_str)


def _next_fixture_date(db: Session, after: str, sport_name: str | None) -> str | None:
    """Earliest calendar day strictly after `after` that has any fixture
    (fantasy or display-only). Powers the empty-day 'jump to next matchday'."""
    after_day = datetime.strptime(after, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    next_start = after_day + timedelta(days=1)

    q = db.query(func.min(Match.match_date)).join(Sport, Match.sport_id == Sport.id).filter(
        Match.match_date >= next_start
    )
    if sport_name:
        q = q.filter(Sport.name == sport_name.strip().lower())
    fantasy_min = q.scalar()

    candidates: list[str] = []
    if fantasy_min is not None:
        dt = fantasy_min if fantasy_min.tzinfo else fantasy_min.replace(tzinfo=timezone.utc)
        candidates.append(dt.astimezone(timezone.utc).strftime("%Y-%m-%d"))

    if not sport_name or sport_name.strip().lower() == "football":
        from app.models.db.competition_snapshot import CompetitionSnapshot
        from app.services.sync.football_competitions import FOOTBALL_COMPETITIONS

        display = [c.tag for c in FOOTBALL_COMPETITIONS.values() if not c.fantasy]
        if display:
            rows = db.query(CompetitionSnapshot).filter(
                CompetitionSnapshot.competition.in_(display),
                CompetitionSnapshot.kind == "matches",
            ).all()
            future = [
                str(m.get("utcDate"))[:10]
                for row in rows
                for m in (row.payload or {}).get("matches", [])
                if str(m.get("utcDate") or "")[:10] > after
            ]
            if future:
                candidates.append(min(future))

    return min(candidates) if candidates else None


@router.get("/fixtures/next", summary="Next calendar day with fixtures after a date")
def next_matchday(
    after: str = Query(description="Find the next fixture day strictly after this YYYY-MM-DD"),
    sport_name: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    try:
        datetime.strptime(after, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=422, detail="after must be in YYYY-MM-DD format")
    return {"date": _next_fixture_date(db, after, sport_name)}


@router.get(
    "/matches/public",
    response_model=MatchListResponse,
    summary="Public fixtures for the landing page (no auth)",
)
def list_public_matches(
    sport_name: str | None = Query(
        default=None, description='Filter by sport slug: "football" | "basketball" | "cricket"'
    ),
    limit: int = Query(default=18, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Unauthenticated fixtures feed for the marketing landing page — no league
    scoping. Blends, in order, live matches → soonest upcoming → most-recent
    results, so the section always has content even off-season. FotMob-style."""
    now = datetime.now(timezone.utc)

    def base():
        q = (
            db.query(Match, Sport.name.label("sport_name"))
            .join(Sport, Match.sport_id == Sport.id)
        )
        if sport_name:
            q = q.filter(Sport.name == sport_name.strip().lower())
        return q

    live = (
        base()
        .filter(Match.status == "live")
        .order_by(Match.match_date.asc())
        .limit(limit)
        .all()
    )
    upcoming = (
        base()
        .filter(Match.status != "live", Match.match_date >= now)
        .order_by(Match.match_date.asc())
        .limit(limit)
        .all()
    )
    recent = (
        base()
        .filter(Match.status != "live", Match.match_date < now)
        .order_by(Match.match_date.desc())
        .limit(limit)
        .all()
    )

    # Concatenate in priority order, de-duplicate by id, cap to limit.
    logo_lookup = _real_team_logo_lookup(db)
    seen: set = set()
    items: list[MatchResponse] = []
    for match, name in [*live, *upcoming, *recent]:
        if match.id in seen:
            continue
        seen.add(match.id)
        items.append(_to_match_response(match, name, logo_lookup))
        if len(items) >= limit:
            break

    return MatchListResponse(items=items, total=len(items))


@router.get(
    "/matches/live-for-favourites",
    response_model=MatchListResponse,
    summary="Live matches involving the caller's favourite teams",
)
def list_live_matches_for_favourites(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """Feeds the dashboard live ticker. Matches store team names as free-text
    strings (no FK), so favourites are matched by canonicalised name within
    the same sport — the exact normalisation the logo lookup above uses.
    Each item carries the current match minute (max minute seen in that
    match's live_events)."""
    favourites = (
        db.query(UserFavouriteTeam.sport_id, RealTeam.name)
        .join(RealTeam, UserFavouriteTeam.real_team_id == RealTeam.id)
        .filter(UserFavouriteTeam.user_id == current_user.id)
        .all()
    )
    if not favourites:
        return MatchListResponse(items=[], total=0)
    # Keys stringified to match the cached (JSON-serialised) global blob.
    favourite_keys = {
        (str(sport_id), MATCH_TEAM_NAME_ALIASES.get(name, name)) for sport_id, name in favourites
    }

    items = [
        MatchResponse(**entry["response"])
        for entry in _live_matches_global(db)
        if (entry["sport_id"], entry["home_key"]) in favourite_keys
        or (entry["sport_id"], entry["away_key"]) in favourite_keys
    ]
    return MatchListResponse(items=items, total=len(items))


def _live_matches_global(db: Session) -> list[dict]:
    """All currently-live matches as serialisable entries (response + the
    sport/team keys the per-user favourites filter matches on). Identical for
    every caller, so it's cached under a single key with a short TTL — the
    live-sync busts it on ingest, so N dashboards refetching on one bell cost
    one DB build, not N. ponytail: 15s TTL absorbs the bell's refetch burst;
    live data itself only changes ~3-hourly (the sync cadence)."""
    cached = cache_get(LIVE_FAVOURITES_CACHE_KEY)
    if cached is not None:
        return cached["items"]

    live_rows = (
        db.query(Match, Sport.name.label("sport_name"))
        .join(Sport, Match.sport_id == Sport.id)
        .filter(Match.status == "live")
        .order_by(Match.match_date.asc())
        .all()
    )
    live_keys = {match.id: (match.external_api_id or str(match.id)) for match, _ in live_rows}
    minute_by_key = {}
    if live_keys:
        minute_by_key = dict(
            db.query(
                LiveEvent.match_id,
                func.max(LiveEvent.meta["minute"].astext.cast(Integer)),
            )
            .filter(LiveEvent.match_id.in_(live_keys.values()))
            .group_by(LiveEvent.match_id)
            .all()
        )

    logo_lookup = _real_team_logo_lookup(db)
    entries = []
    for match, sport_name in live_rows:
        response = _to_match_response(match, sport_name, logo_lookup)
        response.minute = minute_by_key.get(live_keys[match.id])
        entries.append({
            "sport_id": str(match.sport_id),
            "home_key": MATCH_TEAM_NAME_ALIASES.get(match.home_team, match.home_team),
            "away_key": MATCH_TEAM_NAME_ALIASES.get(match.away_team, match.away_team),
            "response": response.model_dump(mode="json"),
        })

    cache_set(LIVE_FAVOURITES_CACHE_KEY, {"items": entries}, ttl_seconds=15)
    return entries

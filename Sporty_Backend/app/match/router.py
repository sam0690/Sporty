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
from app.match.schemas import MatchListResponse, MatchResponse
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
    favourite_keys = {
        (sport_id, MATCH_TEAM_NAME_ALIASES.get(name, name)) for sport_id, name in favourites
    }

    live_rows = (
        db.query(Match, Sport.name.label("sport_name"))
        .join(Sport, Match.sport_id == Sport.id)
        .filter(Match.status == "live")
        .order_by(Match.match_date.asc())
        .all()
    )
    matched = [
        (match, sport_name)
        for match, sport_name in live_rows
        if (match.sport_id, MATCH_TEAM_NAME_ALIASES.get(match.home_team, match.home_team)) in favourite_keys
        or (match.sport_id, MATCH_TEAM_NAME_ALIASES.get(match.away_team, match.away_team)) in favourite_keys
    ]
    if not matched:
        return MatchListResponse(items=[], total=0)

    # Current minute per match: live_events are keyed by external_api_id (or
    # the UUID as a string), one grouped query for all matched matches.
    live_keys = {match.id: (match.external_api_id or str(match.id)) for match, _ in matched}
    minute_rows = (
        db.query(
            LiveEvent.match_id,
            func.max(LiveEvent.meta["minute"].astext.cast(Integer)),
        )
        .filter(LiveEvent.match_id.in_(live_keys.values()))
        .group_by(LiveEvent.match_id)
        .all()
    )
    minute_by_key = dict(minute_rows)

    logo_lookup = _real_team_logo_lookup(db)
    items = []
    for match, sport_name in matched:
        response = _to_match_response(match, sport_name, logo_lookup)
        response.minute = minute_by_key.get(live_keys[match.id])
        items.append(response)
    return MatchListResponse(items=items, total=len(items))

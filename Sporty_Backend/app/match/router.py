"""Match REST router — list fixtures the user is allowed to view.

The realtime routes (`/api/match/{id}/state|prediction|ratings`, websockets)
are keyed by a match id the caller must already know. This list endpoint is
the discovery surface that feeds the frontend Matches/Fixtures page so users
can actually reach the live match view.

Access model: any authenticated user may view all fixtures, regardless of
league membership — matches are a public discovery surface within the app, so
users can browse fixtures before (or without) joining a league.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user
from app.auth.models import User
from app.database import get_db
from app.league.models import Sport
from app.match.models import Match
from app.match.schemas import MatchListResponse, MatchResponse
from app.player.models import RealTeam

router = APIRouter(tags=["Matches"])

# Match.home_team/away_team are free-text strings from the external-API sync,
# which don't always agree with RealTeam.name (used elsewhere for crest
# lookups, e.g. the squad/lineup views) — some fixtures use the short form
# ("Newcastle") where RealTeam uses the long form ("Newcastle United"), or
# vice versa. Explicit alias map, not fuzzy matching, mirroring the same
# fix already applied to the feeder's team-name matching.
MATCH_TEAM_NAME_ALIASES: dict[str, str] = {
    "Brighton": "Brighton &amp; Hove Albion",
    "Newcastle": "Newcastle United",
    "Tottenham": "Tottenham Hotspur",
    "West Ham": "West Ham United",
    "Wolves": "Wolverhampton",
    "Liverpool FC": "Liverpool",
}


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
    summary="List fixtures the user can view",
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
    current_user: User = Depends(get_current_active_user),
):
    # Any authenticated user can browse all fixtures — no league gating.
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

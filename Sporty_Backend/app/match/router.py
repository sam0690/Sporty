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

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user
from app.auth.models import User
from app.database import get_db
from app.league.models import Sport
from app.match.models import Match
from app.match.schemas import MatchListResponse, MatchResponse

router = APIRouter(tags=["Matches"])


def _to_match_response(match: Match, sport_name: str) -> MatchResponse:
    return MatchResponse(
        id=match.id,
        external_api_id=match.external_api_id,
        sport=sport_name,
        home_team=match.home_team,
        away_team=match.away_team,
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

    # Most recent / live first; the UI groups by status.
    rows = query.order_by(Match.match_date.desc()).limit(limit).all()

    items = [_to_match_response(match, name) for match, name in rows]
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
    seen: set = set()
    items: list[MatchResponse] = []
    for match, name in [*live, *upcoming, *recent]:
        if match.id in seen:
            continue
        seen.add(match.id)
        items.append(_to_match_response(match, name))
        if len(items) >= limit:
            break

    return MatchListResponse(items=items, total=len(items))

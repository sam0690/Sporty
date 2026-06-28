"""Match REST router — list fixtures the user is allowed to view.

The realtime routes (`/api/match/{id}/state|prediction|ratings`, websockets)
are keyed by a match id the caller must already know. This list endpoint is
the discovery surface that feeds the frontend Matches/Fixtures page so users
can actually reach the live match view.

Access model: a user may view matches for any sport in which they hold a
league membership — identical to `ensure_user_can_access_match`, so every
match returned here is one the user can subsequently open.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user
from app.auth.models import User
from app.database import get_db
from app.league.models import LeagueMembership, LeagueSport, Sport
from app.match.models import Match
from app.match.schemas import MatchListResponse, MatchResponse

router = APIRouter(tags=["Matches"])


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
    # Sports the user can access (any league they belong to).
    accessible_sport_ids = (
        db.query(LeagueSport.sport_id)
        .join(LeagueMembership, LeagueMembership.league_id == LeagueSport.league_id)
        .filter(LeagueMembership.user_id == current_user.id)
        .distinct()
        .subquery()
    )

    query = (
        db.query(Match, Sport.name.label("sport_name"))
        .join(Sport, Match.sport_id == Sport.id)
        .filter(Match.sport_id.in_(accessible_sport_ids))
    )

    if status:
        query = query.filter(Match.status == status.strip().lower())
    if sport_name:
        query = query.filter(Sport.name == sport_name.strip().lower())

    # Most recent / live first; the UI groups by status.
    rows = query.order_by(Match.match_date.desc()).limit(limit).all()

    items = [
        MatchResponse(
            id=match.id,
            external_api_id=match.external_api_id,
            sport=sport_name_value,
            home_team=match.home_team,
            away_team=match.away_team,
            match_date=match.match_date,
            status=match.status,
            competition=match.competition,
            home_score=match.home_score,
            away_score=match.away_score,
        )
        for match, sport_name_value in rows
    ]
    return MatchListResponse(items=items, total=len(items))

"""Head-to-head weekly matchup endpoints. Read-only — no transaction to own."""
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user
from app.auth.models import User
from app.database import get_db
from app.league.matchup_schemas import H2HStandingRow, MatchupResponse
from app.services import matchup_service

router = APIRouter(prefix="/leagues/{league_id}/matchups", tags=["Head-to-Head"])


@router.get("", response_model=list[MatchupResponse])
def list_matchups(
    league_id: uuid.UUID,
    window_id: uuid.UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return matchup_service.get_matchups_for_window(db, league_id, window_id, current_user)


@router.get("/standings", response_model=list[H2HStandingRow])
def h2h_standings(
    league_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return matchup_service.get_standings(db, league_id, current_user)

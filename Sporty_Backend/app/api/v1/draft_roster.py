"""Draft roster endpoints — Phase 1: free agents.

See docs/DRAFT_ROSTER_MANAGEMENT.md. Draft leagues only. Router owns the
transaction (commits after the service call).
"""
import uuid

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user
from app.auth.models import User
from app.database import get_db
from app.services import draft_roster_service

router = APIRouter(prefix="/leagues/{league_id}/free-agents", tags=["Draft Roster"])


class FreeAgentClaimRequest(BaseModel):
    add_player_id: uuid.UUID
    drop_player_id: uuid.UUID


@router.get("")
def list_free_agents(
    league_id: uuid.UUID,
    position: str | None = Query(default=None),
    search: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Unowned, available players in the draft league's sport pool."""
    return draft_roster_service.get_free_agents(
        db,
        league_id,
        current_user,
        position=position,
        search=search,
        limit=limit,
        offset=offset,
    )


@router.post("/claim")
def claim_free_agent(
    league_id: uuid.UUID,
    payload: FreeAgentClaimRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Instant add/drop of an unowned player (add + drop both required)."""
    result = draft_roster_service.claim_free_agent(
        db,
        league_id,
        payload.add_player_id,
        payload.drop_player_id,
        current_user,
    )
    db.commit()
    return result

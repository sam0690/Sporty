"""Waiver endpoints (draft leagues). Router owns the transaction."""
import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user
from app.auth.models import User
from app.database import get_db
from app.services import waiver_service

router = APIRouter(prefix="/leagues/{league_id}/waivers", tags=["Draft Roster"])


class WaiverClaimRequest(BaseModel):
    add_player_id: uuid.UUID
    drop_player_id: uuid.UUID


class ReorderRequest(BaseModel):
    ordered_claim_ids: list[uuid.UUID]


@router.get("")
def list_my_claims(
    league_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return waiver_service.list_my_claims(db, league_id, current_user)


@router.get("/order")
def waiver_order(
    league_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return waiver_service.get_waiver_order(db, league_id, current_user)


@router.post("")
def submit_claim(
    league_id: uuid.UUID,
    payload: WaiverClaimRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = waiver_service.submit_claim(
        db, league_id, payload.add_player_id, payload.drop_player_id, current_user
    )
    db.commit()
    return result


@router.put("/order")
def reorder_claims(
    league_id: uuid.UUID,
    payload: ReorderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = waiver_service.reorder_claims(
        db, league_id, payload.ordered_claim_ids, current_user
    )
    db.commit()
    return result


@router.delete("/{claim_id}")
def cancel_claim(
    league_id: uuid.UUID,
    claim_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = waiver_service.cancel_claim(db, league_id, claim_id, current_user)
    db.commit()
    return result

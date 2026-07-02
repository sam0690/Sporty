"""Trade endpoints (draft leagues). Router owns the transaction."""
import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user
from app.auth.models import User
from app.database import get_db
from app.services import trade_service

router = APIRouter(prefix="/leagues/{league_id}/trades", tags=["Draft Roster"])


class ProposeTradeRequest(BaseModel):
    to_team_id: uuid.UUID
    offered_player_ids: list[uuid.UUID]
    requested_player_ids: list[uuid.UUID]


@router.get("")
def list_trades(
    league_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return trade_service.list_trades(db, league_id, current_user)


@router.get("/rosters")
def league_rosters(
    league_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    return trade_service.get_league_rosters(db, league_id, current_user)


@router.post("")
def propose_trade(
    league_id: uuid.UUID,
    payload: ProposeTradeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = trade_service.propose_trade(
        db,
        league_id,
        payload.to_team_id,
        payload.offered_player_ids,
        payload.requested_player_ids,
        current_user,
    )
    db.commit()
    return result


@router.post("/{trade_id}/accept")
def accept_trade(
    league_id: uuid.UUID,
    trade_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = trade_service.accept_trade(db, league_id, trade_id, current_user)
    db.commit()
    return result


@router.post("/{trade_id}/reject")
def reject_trade(
    league_id: uuid.UUID,
    trade_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = trade_service.reject_trade(db, league_id, trade_id, current_user)
    db.commit()
    return result


@router.post("/{trade_id}/cancel")
def cancel_trade(
    league_id: uuid.UUID,
    trade_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = trade_service.cancel_trade(db, league_id, trade_id, current_user)
    db.commit()
    return result


@router.post("/{trade_id}/veto")
def veto_trade(
    league_id: uuid.UUID,
    trade_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    result = trade_service.veto_trade(db, league_id, trade_id, current_user)
    db.commit()
    return result

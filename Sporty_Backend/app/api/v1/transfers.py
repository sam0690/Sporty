import uuid

from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel
from redis import Redis
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user
from app.auth.models import User
from app.core.redis import get_redis
from app.database import get_db
from app.services import transfer_service

router = APIRouter(prefix="/transfers", tags=["Transfers"])


class StageOutRequest(BaseModel):
    league_id: uuid.UUID
    gameweek_id: uuid.UUID
    player_id: uuid.UUID


class StageInRequest(BaseModel):
    league_id: uuid.UUID
    gameweek_id: uuid.UUID
    player_id: uuid.UUID


class ConfirmRequest(BaseModel):
    league_id: uuid.UUID
    gameweek_id: uuid.UUID


class CancelRequest(BaseModel):
    # Optional for compatibility; session is identified by current user.
    league_id: uuid.UUID | None = None


@router.post("/stage-out")
def stage_out(
    payload: StageOutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    redis: Redis = get_redis()
    result = transfer_service.stage_out(
        db=db,
        redis=redis,
        league_id=payload.league_id,
        gameweek_id=payload.gameweek_id,
        player_id=payload.player_id,
        current_user=current_user,
    )
    return result


@router.post("/stage-in")
def stage_in(
    payload: StageInRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    redis: Redis = get_redis()
    result = transfer_service.stage_in(
        db=db,
        redis=redis,
        league_id=payload.league_id,
        gameweek_id=payload.gameweek_id,
        player_id=payload.player_id,
        current_user=current_user,
    )
    return result


@router.post("/confirm")
def confirm(
    payload: ConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    redis: Redis = get_redis()
    result = transfer_service.confirm_transfers(
        db=db,
        redis=redis,
        league_id=payload.league_id,
        gameweek_id=payload.gameweek_id,
        current_user=current_user,
    )
    db.commit()
    return result


@router.delete("/cancel", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def cancel(
    _payload: CancelRequest,
    current_user: User = Depends(get_current_active_user),
):
    redis: Redis = get_redis()
    transfer_service.cancel_session(redis=redis, current_user=current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

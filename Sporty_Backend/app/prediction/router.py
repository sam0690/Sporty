"""Predictor REST router — submit predictions and read leaderboards.

All routes are authenticated: predicting and competing require an account.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user
from app.auth.models import User
from app.database import get_db
from app.prediction import services
from app.prediction.schemas import (
    LeaderboardResponse,
    PredictionCreate,
    PredictionListResponse,
    PredictionResponse,
)

router = APIRouter(prefix="/predictions", tags=["Predictions"])


@router.post("", response_model=PredictionResponse, summary="Submit/update a prediction")
def create_prediction(
    payload: PredictionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    return services.upsert_prediction(
        db, user.id, payload.match_id, payload.predicted_home, payload.predicted_away
    )


@router.get("/me", response_model=PredictionListResponse, summary="My predictions")
def my_predictions(
    resolved: bool | None = Query(
        default=None, description="true = scored only, false = pending only, omit = all"
    ),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    items = services.list_my_predictions(db, user.id, resolved=resolved)
    return PredictionListResponse(items=items, total=len(items))


@router.get(
    "/match/{match_id}",
    response_model=PredictionResponse | None,
    summary="My prediction for one fixture",
)
def my_prediction_for_match(
    match_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    return services.get_my_prediction_for_match(db, user.id, match_id)


@router.get(
    "/leaderboard",
    response_model=LeaderboardResponse,
    summary="Predictor leaderboard (global or per-league)",
)
def leaderboard(
    league_id: uuid.UUID | None = Query(
        default=None, description="Restrict to a league's active members; omit for global"
    ),
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
):
    return services.get_leaderboard(
        db, league_id=league_id, current_user_id=user.id, limit=limit
    )

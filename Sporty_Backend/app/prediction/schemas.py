"""Pydantic schemas for the Predictor API."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PredictionCreate(BaseModel):
    """Submit or update an exact-score prediction for a fixture."""

    match_id: uuid.UUID
    predicted_home: int = Field(ge=0, le=99)
    predicted_away: int = Field(ge=0, le=99)


class PredictionResponse(BaseModel):
    """A user's prediction plus the fixture context needed to render it."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    match_id: uuid.UUID
    predicted_home: int
    predicted_away: int
    points_awarded: int | None = None

    # Fixture context (joined in; not columns on PredictionEntry).
    home_team: str
    away_team: str
    match_date: datetime
    match_status: str
    home_score: int | None = None
    away_score: int | None = None
    # True once kickoff has passed — the client disables editing on this.
    locked: bool


class PredictionListResponse(BaseModel):
    items: list[PredictionResponse]
    total: int


class LeaderboardRow(BaseModel):
    user_id: uuid.UUID
    username: str
    total_points: int
    predictions_made: int
    exact_scores: int
    rank: int


class LeaderboardResponse(BaseModel):
    items: list[LeaderboardRow]
    total: int
    # Populated when the caller is authenticated and has any scored prediction.
    me: LeaderboardRow | None = None

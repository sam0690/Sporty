"""Pydantic schemas for the match REST API."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class MatchResponse(BaseModel):
    """A real-world fixture the user can open in the live match view.

    `id` is what the frontend passes to /match/{id}; the realtime routes
    resolve it by either UUID or external_api_id, so the UUID is fine.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    external_api_id: str
    sport: str
    home_team: str
    away_team: str
    match_date: datetime
    status: str
    competition: str
    home_score: int | None = None
    away_score: int | None = None


class MatchListResponse(BaseModel):
    items: list[MatchResponse]
    total: int

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
    home_team_logo_url: str | None = None
    away_team_logo_url: str | None = None
    match_date: datetime
    status: str
    competition: str
    home_score: int | None = None
    away_score: int | None = None
    # Current match minute, populated only by the live-for-favourites endpoint
    # (derived from live_events; None elsewhere and for matches not yet live).
    minute: int | None = None


class MatchListResponse(BaseModel):
    items: list[MatchResponse]
    total: int


class FixtureResponse(BaseModel):
    """A fixture for the unified fixtures page — merges fantasy matches (from
    the `matches` table) with display-only competition matches (Champions
    League, from cached snapshots).

    `source` tells the frontend which detail route to open:
      - "fantasy"  -> the live match view, /match/{id}   (id = match UUID)
      - "<TAG>"    -> the competition match page, /competitions/<tag>/match/{id}
                      (id = football-data.org match id), e.g. source "UCL".
    """

    id: str
    source: str
    sport: str
    competition: str
    home_team: str
    away_team: str
    home_team_logo_url: str | None = None
    away_team_logo_url: str | None = None
    match_date: datetime
    status: str  # normalized: scheduled | live | finished | postponed | cancelled
    home_score: int | None = None
    away_score: int | None = None
    stage: str | None = None  # knockout round label for cup competitions


class FixtureListResponse(BaseModel):
    items: list[FixtureResponse]
    total: int
    date: str


# football-data.org match status -> our normalized vocabulary.
FDO_MATCH_STATUS: dict[str, str] = {
    "SCHEDULED": "scheduled", "TIMED": "scheduled",
    "IN_PLAY": "live", "PAUSED": "live",
    "FINISHED": "finished", "AWARDED": "finished",
    "POSTPONED": "postponed", "SUSPENDED": "postponed", "CANCELLED": "cancelled",
}

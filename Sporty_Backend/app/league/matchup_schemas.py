"""Response schemas for head-to-head weekly matchups. See
app/services/matchup_service.py and docs/HEAD_TO_HEAD_MATCHUPS.md."""

import uuid
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict


class MatchupTeamBrief(BaseModel):
    id: uuid.UUID
    name: str

    model_config = ConfigDict(from_attributes=True)


class MatchupResponse(BaseModel):
    id: uuid.UUID
    transfer_window_id: uuid.UUID
    home_team: MatchupTeamBrief
    away_team: MatchupTeamBrief | None = None
    home_points: Decimal | None = None
    away_points: Decimal | None = None
    result: Literal["home_win", "away_win", "tie", "bye"] | None = None

    model_config = ConfigDict(from_attributes=True)


class H2HStandingRow(BaseModel):
    fantasy_team_id: uuid.UUID
    team_name: str
    wins: int
    losses: int
    ties: int
    points_for: Decimal
    points_against: Decimal

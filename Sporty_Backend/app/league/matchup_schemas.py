"""Response schemas for head-to-head weekly matchups. See
app/services/matchup_service.py and docs/HEAD_TO_HEAD_MATCHUPS.md."""

import uuid
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.schemas.common import UserBrief


class MatchupTeamBrief(BaseModel):
    id: uuid.UUID
    name: str
    # FantasyTeam's relationship is literally named `user` — naming this
    # field to match lets from_attributes resolve it with zero extra code.
    user: UserBrief

    model_config = ConfigDict(from_attributes=True)


class MatchupResponse(BaseModel):
    id: uuid.UUID
    transfer_window_id: uuid.UUID
    window_number: int
    home_team: MatchupTeamBrief
    away_team: MatchupTeamBrief | None = None
    home_points: Decimal | None = None
    away_points: Decimal | None = None
    result: Literal["home_win", "away_win", "tie", "bye"] | None = None

    model_config = ConfigDict(from_attributes=True)


class H2HStandingRow(BaseModel):
    fantasy_team_id: uuid.UUID
    team_name: str
    owner_username: str
    owner_avatar_url: str | None = None
    wins: int
    losses: int
    ties: int
    points_for: Decimal
    points_against: Decimal

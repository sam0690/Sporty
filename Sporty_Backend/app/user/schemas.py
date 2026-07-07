import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.common import PlayerBrief, TeamBrief


class UserProfileResponse(BaseModel):
    id: uuid.UUID
    username: str
    email: EmailStr
    auth_provider: str
    avatar_url: str | None = None
    is_active: bool
    email_notifications_enabled: bool
    favourite_team: TeamBrief | None = None
    favourite_player: PlayerBrief | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserUpdateRequest(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=50)
    avatar_url: str | None = Field(default=None, max_length=500)
    email_notifications_enabled: bool | None = Field(default=None)
    # None means "no change" (same convention as every other field here) —
    # clearing an already-set favourite isn't supported in v1.
    favourite_team_id: uuid.UUID | None = Field(default=None)
    favourite_player_id: uuid.UUID | None = Field(default=None)


class UserListResponse(BaseModel):
    items: list[UserProfileResponse]
    total: int
    page: int
    page_size: int
    has_next: bool


class UserPublicLeagueResponse(BaseModel):
    league_id: uuid.UUID | None = None
    name: str
    sport: str
    rank: int | None = None
    points: float = 0.0


class UserPublicStatsResponse(BaseModel):
    user_id: uuid.UUID
    username: str
    avatar_url: str | None = None
    created_at: datetime
    total_points: float = 0.0
    total_leagues: int = 0
    best_rank: int | None = None
    leagues: list[UserPublicLeagueResponse] = []


class UserActivityLeagueResponse(BaseModel):
    id: uuid.UUID
    name: str
    sports: list[str] = []


class UserActivityResponse(BaseModel):
    id: str
    type: Literal[
        "transfer",
        "points",
        "lineup",
        "rank",
        "league_joined",
        "league_created",
    ]
    title: str
    description: str
    timestamp: datetime
    league: UserActivityLeagueResponse
    details: dict[str, Any] = {}

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserProfileResponse(BaseModel):
    id: uuid.UUID
    username: str
    email: EmailStr
    auth_provider: str
    avatar_url: str | None = None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserUpdateRequest(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=50)
    avatar_url: str | None = Field(default=None, max_length=500)


class UserListResponse(BaseModel):
    items: list[UserProfileResponse]
    total: int
    page: int
    page_size: int
    has_next: bool


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

import uuid
from datetime import datetime

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

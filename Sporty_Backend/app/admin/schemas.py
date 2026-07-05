import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.admin.models import AdminActionType
from app.auth.models import UserRole
from app.league.models import LeagueStatus


# ── Users ───────────────────────────────────────────────────────────────────────

class AdminUserListItem(BaseModel):
    id: uuid.UUID
    username: str
    email: str
    role: UserRole
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminUserListResponse(BaseModel):
    items: list[AdminUserListItem]
    total: int
    page: int
    page_size: int
    has_next: bool


class AdminUserDetail(AdminUserListItem):
    auth_provider: str
    avatar_url: str | None = None


class RoleChangeRequest(BaseModel):
    role: UserRole
    reason: str | None = Field(default=None, max_length=1000)


# ── Leagues ─────────────────────────────────────────────────────────────────────

class AdminLeagueListItem(BaseModel):
    id: uuid.UUID
    name: str
    status: LeagueStatus
    owner_id: uuid.UUID
    owner_username: str
    is_public: bool
    draft_mode: bool
    created_at: datetime


class AdminLeagueListResponse(BaseModel):
    items: list[AdminLeagueListItem]
    total: int
    page: int
    page_size: int
    has_next: bool


class LeagueStatusOverrideRequest(BaseModel):
    new_status: LeagueStatus
    reason: str | None = Field(default=None, max_length=1000)


class LeagueSettingsOverrideRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    is_public: bool | None = None
    reason: str | None = Field(default=None, max_length=1000)


class AdminActionReason(BaseModel):
    reason: str | None = Field(default=None, max_length=1000)


class AdminAuditLogResponse(BaseModel):
    id: uuid.UUID
    actor_user_id: uuid.UUID
    actor_username_snapshot: str
    action: AdminActionType
    target_type: str
    target_id: str
    reason: str | None = None
    metadata_json: dict | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminAuditLogListResponse(BaseModel):
    items: list[AdminAuditLogResponse]
    total: int
    page: int
    page_size: int
    has_next: bool

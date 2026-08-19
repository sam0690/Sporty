import uuid
from datetime import datetime
from typing import Annotated, Optional, Union

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.schemas.common import PlayerBrief, TeamBrief


def _bcrypt_safe(v: str) -> str:
    """Reject passwords past bcrypt's 72-byte input limit.

    bcrypt truncates silently, so without this any two passwords sharing their
    first 72 bytes hash identically and both unlock the account. Measured in
    BYTES, not characters — 72 emoji is ~288 bytes and would still truncate,
    which a plain max_length=72 would wave through.
    """
    if len(v.encode("utf-8")) > 72:
        raise ValueError("Password must be at most 72 bytes")
    return v


# Set on password *writes* only. LoginRequest.password stays unvalidated on
# purpose: anyone who registered a >72-byte password before this existed
# authenticates today via truncation, and validating at login would reject the
# password they actually use and lock them out of their own account.
Password = Annotated[str, Field(min_length=8), AfterValidator(_bcrypt_safe)]


# ── Requests ──────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: Password
    auto_login: bool = Field(default=False, description="If true, returns access/refresh tokens. If false, returns user object only.")


class LoginRequest(BaseModel):
    identifier: str = Field(min_length=1, max_length=255)
    password: str


class GoogleAuthRequest(BaseModel):
    code: str


class GoogleLinkRequest(BaseModel):
    link_token: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    detail: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: Password


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: Password


# ── Responses ─────────────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    is_new_user: bool = False


class UserResponse(BaseModel):
    id: uuid.UUID
    username: str
    email: str
    auth_provider: str
    google_id: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool
    role: str
    email_notifications_enabled: bool
    # One entry per sport (see app/player/models.py UserFavouriteTeam/Player).
    favourite_teams: list[TeamBrief] = []
    favourite_players: list[PlayerBrief] = []
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_validator("favourite_teams", mode="before")
    @classmethod
    def _unwrap_favourite_teams(cls, v):
        return [fav.real_team for fav in v] if v else v

    @field_validator("favourite_players", mode="before")
    @classmethod
    def _unwrap_favourite_players(cls, v):
        return [fav.player for fav in v] if v else v


class GoogleAccountLinkRequiredResponse(BaseModel):
    error: str = "account_exists_link_required"
    message: str
    email: str
    googleLinkToken: str


class GoogleLinkSuccessResponse(BaseModel):
    user: UserResponse
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


# Union type for register endpoint (returns tokens OR user object)
RegisterResponse = Union[TokenResponse, UserResponse]
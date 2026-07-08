import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import UserBrief


class ChatMessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=1000)


class ReactionToggleRequest(BaseModel):
    emoji: str = Field(min_length=1, max_length=8)


class ChatReactionSummary(BaseModel):
    """One emoji's reaction count on a message, plus whether the requesting
    user is one of the reactors (so the UI can highlight it as "yours")."""
    emoji: str
    count: int
    reacted_by_me: bool

    model_config = ConfigDict(from_attributes=True)


class ChatMessageResponse(BaseModel):
    id: uuid.UUID
    league_id: uuid.UUID
    user: UserBrief
    body: str
    created_at: datetime
    can_delete: bool
    reactions: list[ChatReactionSummary] = []

    model_config = ConfigDict(from_attributes=True)

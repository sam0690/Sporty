import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.support.models import TicketCategory, TicketPriority, TicketStatus


class TicketCreateRequest(BaseModel):
    subject: str = Field(min_length=1, max_length=200)
    category: TicketCategory
    league_id: uuid.UUID | None = None
    body: str = Field(min_length=1)


class TicketMessageCreateRequest(BaseModel):
    body: str = Field(min_length=1)


class TicketMessageResponse(BaseModel):
    id: uuid.UUID
    author_user_id: uuid.UUID
    body: str
    is_internal_note: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TicketResponse(BaseModel):
    id: uuid.UUID
    reporter_user_id: uuid.UUID
    league_id: uuid.UUID | None
    subject: str
    category: TicketCategory
    priority: TicketPriority
    status: TicketStatus
    assigned_admin_user_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    resolved_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class TicketDetailResponse(TicketResponse):
    messages: list[TicketMessageResponse]


class TicketListResponse(BaseModel):
    items: list[TicketResponse]
    total: int
    page: int
    page_size: int
    has_next: bool

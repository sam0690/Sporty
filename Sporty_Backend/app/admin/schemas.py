import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.admin.models import AdminActionType


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

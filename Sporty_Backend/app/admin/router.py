from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.admin import services
from app.admin.dependencies import require_admin_role
from app.admin.schemas import AdminAuditLogListResponse
from app.auth.models import User, UserRole
from app.database import get_db

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/audit-log", response_model=AdminAuditLogListResponse, summary="List admin audit log entries")
def list_audit_log(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_admin_role(UserRole.SUPPORT)),
):
    items, total = services.list_audit_log(db, page=page, page_size=page_size)
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_next": (page * page_size) < total,
    }

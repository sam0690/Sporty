from sqlalchemy.orm import Session

from app.admin.models import AdminAuditLog


def list_audit_log(db: Session, page: int, page_size: int) -> tuple[list[AdminAuditLog], int]:
    query = db.query(AdminAuditLog).order_by(AdminAuditLog.created_at.desc())
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return items, total

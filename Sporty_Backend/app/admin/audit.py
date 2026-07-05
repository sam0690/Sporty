"""Audit-log write helper for admin actions.

Follows the codebase's "services never commit" convention (see CLAUDE.md):
this only db.add()s the row, in the same transaction as the mutation it
describes. The caller's router/service owns the commit, so the audit row
and the action it records are always atomic with each other.
"""

import uuid

from sqlalchemy.orm import Session

from app.admin.models import AdminActionType, AdminAuditLog
from app.auth.models import User


def record_admin_action(
    db: Session,
    actor: User,
    action: AdminActionType,
    target_type: str,
    target_id: str | uuid.UUID,
    reason: str | None = None,
    metadata: dict | None = None,
) -> AdminAuditLog:
    entry = AdminAuditLog(
        actor_user_id=actor.id,
        actor_username_snapshot=actor.username,
        action=action,
        target_type=target_type,
        target_id=str(target_id),
        reason=reason,
        metadata_json=metadata,
    )
    db.add(entry)
    return entry

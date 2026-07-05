import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.admin.models import AdminActionType, AdminAuditLog
from app.admin.audit import record_admin_action
from app.auth import services as auth_services
from app.auth.models import User, UserRole
from app.league import services as league_service
from app.league.models import League, LeagueStatus
from app.user import services as user_services


# ── Audit log ───────────────────────────────────────────────────────────────────

def list_audit_log(db: Session, page: int, page_size: int) -> tuple[list[AdminAuditLog], int]:
    query = db.query(AdminAuditLog).order_by(AdminAuditLog.created_at.desc())
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return items, total


# ── Users ───────────────────────────────────────────────────────────────────────

def list_users_admin(
    db: Session,
    page: int,
    page_size: int,
    search: str | None = None,
    role: UserRole | None = None,
    is_active: bool | None = None,
) -> tuple[list[User], int]:
    """Unlike user.services.get_users (active-only), this surfaces every
    user regardless of status — an admin needs to find suspended accounts."""
    query = db.query(User)
    if search:
        like = f"%{search}%"
        query = query.filter(
            (User.username.ilike(like)) | (User.email.ilike(like))
        )
    if role is not None:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active.is_(is_active))
    query = query.order_by(User.created_at.desc())

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return items, total


def get_user_admin(db: Session, user_id: uuid.UUID) -> User:
    """Unlike user.services.get_user, does not filter on is_active — an
    admin must be able to look up suspended accounts too."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def suspend_user(
    db: Session,
    actor: User,
    target_user_id: uuid.UUID,
    reason: str | None = None,
) -> User:
    user_services.delete_user(db, target_user_id, actor.id, admin_override=True)
    auth_services.logout_all_devices(db, target_user_id)
    record_admin_action(
        db,
        actor=actor,
        action=AdminActionType.USER_SUSPEND,
        target_type="user",
        target_id=target_user_id,
        reason=reason,
    )
    db.commit()
    return get_user_admin(db, target_user_id)


def reactivate_user(
    db: Session,
    actor: User,
    target_user_id: uuid.UUID,
    reason: str | None = None,
) -> User:
    user = get_user_admin(db, target_user_id)
    user.is_active = True
    record_admin_action(
        db,
        actor=actor,
        action=AdminActionType.USER_REACTIVATE,
        target_type="user",
        target_id=target_user_id,
        reason=reason,
    )
    db.commit()
    db.refresh(user)
    return user


def force_logout_user(
    db: Session,
    actor: User,
    target_user_id: uuid.UUID,
    reason: str | None = None,
) -> int:
    get_user_admin(db, target_user_id)  # 404 if the user doesn't exist
    revoked_count = auth_services.logout_all_devices(db, target_user_id)
    record_admin_action(
        db,
        actor=actor,
        action=AdminActionType.USER_FORCE_LOGOUT,
        target_type="user",
        target_id=target_user_id,
        reason=reason,
        metadata={"revoked_count": revoked_count},
    )
    db.commit()
    return revoked_count


def change_user_role(
    db: Session,
    actor: User,
    target_user_id: uuid.UUID,
    new_role: UserRole,
    reason: str | None = None,
) -> User:
    if target_user_id == actor.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot change your own role",
        )

    user = get_user_admin(db, target_user_id)
    old_role = user.role

    if old_role == UserRole.SUPER_ADMIN and new_role != UserRole.SUPER_ADMIN:
        remaining = (
            db.query(User)
            .filter(User.role == UserRole.SUPER_ADMIN, User.id != user.id)
            .count()
        )
        if remaining == 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot demote the last remaining super admin",
            )

    user.role = new_role
    record_admin_action(
        db,
        actor=actor,
        action=AdminActionType.USER_ROLE_CHANGE,
        target_type="user",
        target_id=target_user_id,
        reason=reason,
        metadata={"old_role": old_role.value, "new_role": new_role.value},
    )
    db.commit()
    db.refresh(user)
    return user


# ── Leagues ─────────────────────────────────────────────────────────────────────

def list_leagues_admin(
    db: Session,
    page: int,
    page_size: int,
    search: str | None = None,
    status_filter: LeagueStatus | None = None,
) -> tuple[list[tuple[League, str]], int]:
    """Platform-wide league listing (no ownership/membership scoping).
    Returns (league, owner_username) pairs."""
    query = db.query(League, User.username).join(User, User.id == League.owner_id)
    if search:
        query = query.filter(League.name.ilike(f"%{search}%"))
    if status_filter is not None:
        query = query.filter(League.status == status_filter)
    query = query.order_by(League.created_at.desc())

    total = query.count()
    rows = query.offset((page - 1) * page_size).limit(page_size).all()
    return rows, total


def override_league_status(
    db: Session,
    actor: User,
    league_id: uuid.UUID,
    new_status: LeagueStatus,
    reason: str | None = None,
) -> League:
    league = league_service.update_league_status(db, league_id, new_status, actor, admin_override=True)
    record_admin_action(
        db,
        actor=actor,
        action=AdminActionType.LEAGUE_STATUS_OVERRIDE,
        target_type="league",
        target_id=league_id,
        reason=reason,
        metadata={"new_status": new_status.value},
    )
    db.commit()
    return league


def override_delete_league(
    db: Session,
    actor: User,
    league_id: uuid.UUID,
    reason: str | None = None,
) -> None:
    league_service.delete_league(db, league_id, actor, admin_override=True)
    record_admin_action(
        db,
        actor=actor,
        action=AdminActionType.LEAGUE_DELETE_OVERRIDE,
        target_type="league",
        target_id=league_id,
        reason=reason,
    )
    db.commit()


def override_league_settings(
    db: Session,
    actor: User,
    league_id: uuid.UUID,
    name: str | None = None,
    is_public: bool | None = None,
    reason: str | None = None,
) -> League:
    league = league_service.update_league_settings(db, league_id, name=name, is_public=is_public)
    record_admin_action(
        db,
        actor=actor,
        action=AdminActionType.LEAGUE_SETTINGS_OVERRIDE,
        target_type="league",
        target_id=league_id,
        reason=reason,
        metadata={"name": name, "is_public": is_public},
    )
    db.commit()
    return league

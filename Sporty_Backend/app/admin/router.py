import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.admin import services
from app.admin.dependencies import require_admin_role
from app.admin.schemas import (
    AdminActionReason,
    AdminAuditLogListResponse,
    AdminLeagueListItem,
    AdminLeagueListResponse,
    AdminUserDetail,
    AdminUserListResponse,
    LeagueSettingsOverrideRequest,
    LeagueStatusOverrideRequest,
    RoleChangeRequest,
)
from app.auth.models import User, UserRole
from app.database import get_db
from app.league.dependencies import _get_league_or_404
from app.league.models import League, LeagueStatus
from app.league.schemas import LeagueResponse

router = APIRouter(prefix="/admin", tags=["Admin"])


# ── Audit log ───────────────────────────────────────────────────────────────────

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


# ── Users ───────────────────────────────────────────────────────────────────────

@router.get("/users", response_model=AdminUserListResponse, summary="List all users (admin)")
def list_users(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None),
    role: UserRole | None = Query(default=None),
    is_active: bool | None = Query(default=None),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_admin_role(UserRole.ADMIN)),
):
    items, total = services.list_users_admin(
        db, page=page, page_size=page_size, search=search, role=role, is_active=is_active
    )
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_next": (page * page_size) < total,
    }


@router.get("/users/{user_id}", response_model=AdminUserDetail, summary="Get a user (admin)")
def get_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_admin_role(UserRole.ADMIN)),
):
    return services.get_user_admin(db, user_id)


@router.post("/users/{user_id}/suspend", response_model=AdminUserDetail, summary="Suspend a user (admin)")
def suspend_user(
    user_id: uuid.UUID,
    data: AdminActionReason,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role(UserRole.ADMIN)),
):
    return services.suspend_user(db, current_user, user_id, reason=data.reason)


@router.post("/users/{user_id}/reactivate", response_model=AdminUserDetail, summary="Reactivate a user (admin)")
def reactivate_user(
    user_id: uuid.UUID,
    data: AdminActionReason,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role(UserRole.ADMIN)),
):
    return services.reactivate_user(db, current_user, user_id, reason=data.reason)


@router.post("/users/{user_id}/force-logout", summary="Force-logout a user from all devices (admin)")
def force_logout_user(
    user_id: uuid.UUID,
    data: AdminActionReason,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role(UserRole.ADMIN)),
):
    revoked = services.force_logout_user(db, current_user, user_id, reason=data.reason)
    return {"revoked_count": revoked}


@router.patch("/users/{user_id}/role", response_model=AdminUserDetail, summary="Change a user's role (super admin)")
def change_user_role(
    user_id: uuid.UUID,
    data: RoleChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role(UserRole.SUPER_ADMIN)),
):
    return services.change_user_role(db, current_user, user_id, data.role, reason=data.reason)


# ── Leagues ─────────────────────────────────────────────────────────────────────

@router.get("/leagues", response_model=AdminLeagueListResponse, summary="List all leagues platform-wide (admin)")
def list_leagues(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None),
    status_filter: LeagueStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_admin_role(UserRole.ADMIN)),
):
    rows, total = services.list_leagues_admin(
        db, page=page, page_size=page_size, search=search, status_filter=status_filter
    )
    items = [
        AdminLeagueListItem(
            id=league.id,
            name=league.name,
            status=league.status,
            owner_id=league.owner_id,
            owner_username=owner_username,
            is_public=league.is_public,
            draft_mode=league.draft_mode,
            created_at=league.created_at,
        )
        for league, owner_username in rows
    ]
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_next": (page * page_size) < total,
    }


@router.post(
    "/leagues/{league_id}/status",
    response_model=LeagueResponse,
    summary="Override a league's lifecycle status (admin)",
)
def override_league_status(
    data: LeagueStatusOverrideRequest,
    league: League = Depends(_get_league_or_404),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role(UserRole.ADMIN)),
):
    return services.override_league_status(db, current_user, league.id, data.new_status, reason=data.reason)


@router.delete("/leagues/{league_id}", status_code=204, summary="Force-delete a league (admin)")
def override_delete_league(
    league: League = Depends(_get_league_or_404),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role(UserRole.SUPER_ADMIN)),
):
    services.override_delete_league(db, current_user, league.id)


@router.patch(
    "/leagues/{league_id}/settings",
    response_model=LeagueResponse,
    summary="Override a league's settings (admin)",
)
def override_league_settings(
    data: LeagueSettingsOverrideRequest,
    league: League = Depends(_get_league_or_404),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role(UserRole.ADMIN)),
):
    return services.override_league_settings(
        db, current_user, league.id, name=data.name, is_public=data.is_public, reason=data.reason
    )

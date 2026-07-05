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
    AdminPlayerDetail,
    AdminPlayerEditRequest,
    AdminUserDetail,
    AdminUserListResponse,
    CeleryJobsResponse,
    FeatureFlagToggleRequest,
    KafkaJobsResponse,
    LeagueSettingsOverrideRequest,
    LeagueStatusOverrideRequest,
    RepriceRequest,
    RepriceResponse,
    RoleChangeRequest,
    ScoringRecalculateResponse,
    SystemConfigResponse,
    TradeActionResponse,
    TransferReverseResponse,
    TransferWindowLockResponse,
    WaiverClaimCancelResponse,
    WindowLockRequest,
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


# ── Scoring ─────────────────────────────────────────────────────────────────────

@router.post(
    "/leagues/{league_id}/transfer-windows/{window_id}/recalculate-score",
    response_model=ScoringRecalculateResponse,
    summary="Recalculate scoring for a league's transfer window (admin)",
)
def recalculate_window_score(
    window_id: uuid.UUID,
    data: AdminActionReason,
    league: League = Depends(_get_league_or_404),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role(UserRole.ADMIN)),
):
    return services.recalculate_window_score(db, current_user, league.id, window_id, reason=data.reason)


@router.post(
    "/scoring/recalculate-active",
    response_model=ScoringRecalculateResponse,
    summary="Recalculate scoring for every active transfer window platform-wide (super admin)",
)
def recalculate_active_windows(
    data: AdminActionReason,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role(UserRole.SUPER_ADMIN)),
):
    return services.recalculate_active_windows(db, current_user, reason=data.reason)


@router.post(
    "/transfer-windows/{window_id}/lock",
    response_model=TransferWindowLockResponse,
    summary="Force-set a transfer window's lock flags (admin)",
)
def set_window_lock(
    window_id: uuid.UUID,
    data: WindowLockRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role(UserRole.ADMIN)),
):
    return services.set_window_lock(
        db,
        current_user,
        window_id,
        transfers_locked=data.transfers_locked,
        lineup_locked=data.lineup_locked,
        reason=data.reason,
    )


# ── Players / pricing ───────────────────────────────────────────────────────────

@router.get("/players/{player_id}", response_model=AdminPlayerDetail, summary="Get a player (admin)")
def get_player(
    player_id: uuid.UUID,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_admin_role(UserRole.ADMIN)),
):
    return services.get_player_admin(db, player_id)


@router.patch(
    "/players/{player_id}",
    response_model=AdminPlayerDetail,
    summary="Edit a player's data directly (super admin)",
)
def edit_player(
    player_id: uuid.UUID,
    data: AdminPlayerEditRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role(UserRole.SUPER_ADMIN)),
):
    return services.edit_player(
        db,
        current_user,
        player_id,
        name=data.name,
        position=data.position,
        cost=data.cost,
        is_available=data.is_available,
        photo_url=data.photo_url,
        reason=data.reason,
    )


@router.post(
    "/players/reprice",
    response_model=RepriceResponse,
    summary="Trigger a player repricing pass (admin)",
)
def trigger_repricing(
    data: RepriceRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role(UserRole.ADMIN)),
):
    return services.trigger_repricing(db, current_user, lookback_windows=data.lookback_windows, reason=data.reason)


# ── Transactions (trades / waivers / transfers) ─────────────────────────────────

@router.post(
    "/leagues/{league_id}/trades/{trade_id}/veto",
    response_model=TradeActionResponse,
    summary="Veto a trade regardless of league ownership (admin)",
)
def admin_veto_trade(
    trade_id: uuid.UUID,
    data: AdminActionReason,
    league: League = Depends(_get_league_or_404),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role(UserRole.ADMIN)),
):
    return services.admin_veto_trade(db, current_user, league.id, trade_id, reason=data.reason)


@router.post(
    "/leagues/{league_id}/trades/{trade_id}/cancel",
    response_model=TradeActionResponse,
    summary="Force-cancel a trade regardless of who proposed it (admin)",
)
def admin_cancel_trade(
    trade_id: uuid.UUID,
    data: AdminActionReason,
    league: League = Depends(_get_league_or_404),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role(UserRole.ADMIN)),
):
    return services.admin_cancel_trade(db, current_user, league.id, trade_id, reason=data.reason)


@router.post(
    "/leagues/{league_id}/waivers/{claim_id}/cancel",
    response_model=WaiverClaimCancelResponse,
    summary="Force-cancel a pending waiver claim (admin)",
)
def admin_cancel_waiver_claim(
    claim_id: uuid.UUID,
    data: AdminActionReason,
    league: League = Depends(_get_league_or_404),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role(UserRole.ADMIN)),
):
    return services.admin_cancel_waiver_claim(db, current_user, league.id, claim_id, reason=data.reason)


@router.post(
    "/transfers/{transfer_id}/reverse",
    response_model=TransferReverseResponse,
    summary="Reverse a budget-mode transfer as a compensating entry (super admin)",
)
def admin_reverse_transfer(
    transfer_id: uuid.UUID,
    data: AdminActionReason,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role(UserRole.SUPER_ADMIN)),
):
    transfer = services.admin_reverse_transfer(db, current_user, transfer_id, reason=data.reason)
    return {"transfer_id": str(transfer.id), "reversed": transfer.reversed_at is not None}


# ── Job visibility ───────────────────────────────────────────────────────────────

@router.get("/jobs/celery", response_model=CeleryJobsResponse, summary="Celery worker/beat status (admin)")
def get_celery_jobs(
    _current_user: User = Depends(require_admin_role(UserRole.SUPPORT)),
):
    return services.get_celery_jobs_status()


@router.get("/jobs/kafka", response_model=KafkaJobsResponse, summary="Kafka consumer liveness (admin)")
def get_kafka_jobs(
    _current_user: User = Depends(require_admin_role(UserRole.SUPPORT)),
):
    return services.get_kafka_jobs_status()


# ── System config / feature flags ───────────────────────────────────────────────

@router.get("/config", response_model=list[SystemConfigResponse], summary="List runtime feature-flag overrides (admin)")
def list_system_config(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_admin_role(UserRole.SUPPORT)),
):
    return services.list_system_config(db)


@router.post(
    "/config/realtime-pipeline",
    response_model=SystemConfigResponse,
    summary="Toggle the realtime Kafka pipeline flag — restart required (super admin)",
)
def toggle_realtime_pipeline(
    data: FeatureFlagToggleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role(UserRole.SUPER_ADMIN)),
):
    return services.toggle_realtime_pipeline(db, current_user, data.enabled, reason=data.reason)


@router.post(
    "/config/live-polling",
    response_model=SystemConfigResponse,
    summary="Toggle live external-API polling for football/NBA (admin)",
)
def toggle_live_polling(
    data: FeatureFlagToggleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role(UserRole.ADMIN)),
):
    return services.toggle_live_polling(db, current_user, data.enabled, reason=data.reason)

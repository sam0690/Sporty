import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.admin import services
from app.admin.dependencies import require_admin_role
from app.admin.schemas import (  # noqa: F401 (extended below)
    ScoringRuleCreate,
    ScoringRuleListResponse,
    ScoringRuleResponse,
    ScoringRuleUpdate,
    AdminActionReason,
    AdminAuditLogListResponse,
    AdminLeagueListItem,
    AdminLeagueListResponse,
    AdminPlayerDetail,
    AdminPlayerEditRequest,
    AdminTicketDetail,
    AdminTicketListItem,
    AdminTicketListResponse,
    AdminTicketMessageCreateRequest,
    AdminTradeItem,
    AdminTransferItem,
    AdminTransferWindowItem,
    AdminUserDetail,
    AdminUserListResponse,
    AdminWaiverClaimItem,
    CeleryJobsResponse,
    FeatureFlagToggleRequest,
    KafkaJobsResponse,
    LeagueSettingsOverrideRequest,
    LeagueStatusOverrideRequest,
    RepriceRequest,
    RepriceResponse,
    RoleChangeRequest,
    ScoringRecalculateResponse,
    SeasonCreateRequest,
    SeasonGenerateWindowsRequest,
    SeasonUpdateRequest,
    UnifiedSeasonCreateRequest,
    SystemConfigResponse,
    TicketUpdateRequest,
    TradeActionResponse,
    TransferReverseResponse,
    TransferWindowLockResponse,
    WaiverClaimCancelResponse,
    WindowLockRequest,
)
from app.auth.models import User, UserRole
from app.database import get_db
from app.league.dependencies import _get_league_or_404
from app.support import services as support_services
from app.support.models import TicketStatus
from app.support.schemas import TicketMessageResponse
from app.league.models import League, LeagueStatus
from app.league.schemas import LeagueResponse, SeasonResponse

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


@router.delete("/users/{user_id}", status_code=204, summary="Delete a user (super admin)")
def delete_user(
    user_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role(UserRole.SUPER_ADMIN)),
):
    services.delete_user_admin(db, current_user, user_id)


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


# ── Seasons ─────────────────────────────────────────────────────────────────────

@router.get("/seasons", response_model=list[SeasonResponse], summary="List all seasons across all sports (admin)")
def list_seasons(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role(UserRole.ADMIN)),
):
    return services.list_seasons_admin(db)


@router.post(
    "/seasons",
    response_model=SeasonResponse,
    status_code=201,
    summary="Create a season for a sport (admin)",
)
def create_season(
    data: SeasonCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role(UserRole.ADMIN)),
):
    return services.create_season_admin(
        db,
        current_user,
        sport_id=data.sport_id,
        name=data.name,
        start_date=data.start_date,
        end_date=data.end_date,
        label=data.label,
        reason=data.reason,
    )


@router.post(
    "/seasons/unified",
    response_model=SeasonResponse,
    status_code=201,
    summary="Create a unified multisport season (admin)",
)
def create_unified_season(
    data: UnifiedSeasonCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role(UserRole.ADMIN)),
):
    """Compose a unified season from 2+ sports. Dates are derived server-side as
    the overlap of the component sports' current seasons — not supplied."""
    return services.create_unified_season_admin(
        db,
        current_user,
        component_sport_ids=data.component_sport_ids,
        name=data.name,
        label=data.label,
        reason=data.reason,
    )


@router.patch(
    "/seasons/{season_id}",
    response_model=SeasonResponse,
    summary="Update a season (admin)",
)
def update_season(
    season_id: uuid.UUID,
    data: SeasonUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role(UserRole.ADMIN)),
):
    return services.update_season_admin(
        db,
        current_user,
        season_id,
        name=data.name,
        start_date=data.start_date,
        end_date=data.end_date,
        is_active=data.is_active,
        label=data.label,
        reason=data.reason,
    )


@router.post(
    "/seasons/{season_id}/generate-windows",
    response_model=SeasonResponse,
    summary="Generate transfer windows for a season (admin)",
)
def generate_season_windows(
    season_id: uuid.UUID,
    data: SeasonGenerateWindowsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role(UserRole.ADMIN)),
):
    """Generate one transfer window per week for this season, shared by every
    league on it. A no-op (returns the existing windows) if the season
    already has windows."""
    return services.generate_season_windows_admin(
        db,
        current_user,
        season_id,
        transfer_day=data.transfer_day,
        reason=data.reason,
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


# ── Support tickets ───────────────────────────────────────────────────────────────

def _ticket_list_item(ticket, reporter_username: str, assigned_username: str | None) -> AdminTicketListItem:
    return AdminTicketListItem(
        id=ticket.id,
        reporter_user_id=ticket.reporter_user_id,
        reporter_username=reporter_username,
        league_id=ticket.league_id,
        subject=ticket.subject,
        category=ticket.category,
        priority=ticket.priority,
        status=ticket.status,
        assigned_admin_user_id=ticket.assigned_admin_user_id,
        assigned_admin_username=assigned_username,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
    )


@router.get("/tickets", response_model=AdminTicketListResponse, summary="List support tickets (admin)")
def list_tickets(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: TicketStatus | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_admin_role(UserRole.SUPPORT)),
):
    rows, total = services.list_tickets_admin(db, page=page, page_size=page_size, status_filter=status_filter)
    items = [_ticket_list_item(ticket, reporter, assignee) for ticket, reporter, assignee in rows]
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "has_next": (page * page_size) < total,
    }


@router.get("/tickets/{ticket_id}", response_model=AdminTicketDetail, summary="Get a ticket, including internal notes (admin)")
def get_ticket(
    ticket_id: uuid.UUID,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_admin_role(UserRole.SUPPORT)),
):
    ticket = services.get_ticket_admin(db, ticket_id)
    reporter_username, assigned_username = services._ticket_usernames(db, ticket)
    messages = support_services.list_messages(db, ticket_id, include_internal=True)
    return AdminTicketDetail(
        **_ticket_list_item(ticket, reporter_username, assigned_username).model_dump(),
        resolved_at=ticket.resolved_at,
        messages=[TicketMessageResponse.model_validate(m) for m in messages],
    )


@router.patch("/tickets/{ticket_id}", response_model=AdminTicketDetail, summary="Update a ticket's status/priority/assignment (admin)")
def update_ticket(
    ticket_id: uuid.UUID,
    data: TicketUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role(UserRole.SUPPORT)),
):
    ticket = services.update_ticket_admin(
        db, current_user, ticket_id,
        new_status=data.status, priority=data.priority,
        assigned_admin_user_id=data.assigned_admin_user_id, reason=data.reason,
    )
    reporter_username, assigned_username = services._ticket_usernames(db, ticket)
    messages = support_services.list_messages(db, ticket_id, include_internal=True)
    return AdminTicketDetail(
        **_ticket_list_item(ticket, reporter_username, assigned_username).model_dump(),
        resolved_at=ticket.resolved_at,
        messages=[TicketMessageResponse.model_validate(m) for m in messages],
    )


@router.post("/tickets/{ticket_id}/messages", response_model=TicketMessageResponse, summary="Reply to a ticket, optionally as an internal note (admin)")
def add_ticket_message(
    ticket_id: uuid.UUID,
    data: AdminTicketMessageCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role(UserRole.SUPPORT)),
):
    return services.add_ticket_message_admin(
        db, current_user, ticket_id, data.body, is_internal_note=data.is_internal_note
    )


# ── Browse endpoints for the Scoring/Transactions pickers ──────────────────────

@router.get(
    "/leagues/{league_id}/transfer-windows",
    response_model=list[AdminTransferWindowItem],
    summary="List a league's transfer windows (admin)",
)
def list_transfer_windows(
    league: League = Depends(_get_league_or_404),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_admin_role(UserRole.ADMIN)),
):
    return services.list_transfer_windows_for_league(db, league.id)


@router.get(
    "/leagues/{league_id}/trades",
    response_model=list[AdminTradeItem],
    summary="List a league's trades, platform-wide (admin)",
)
def list_trades(
    league: League = Depends(_get_league_or_404),
    only_actionable: bool = Query(default=True),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_admin_role(UserRole.ADMIN)),
):
    return services.list_trades_for_league(db, league.id, only_actionable=only_actionable)


@router.get(
    "/leagues/{league_id}/waivers",
    response_model=list[AdminWaiverClaimItem],
    summary="List a league's waiver claims, platform-wide (admin)",
)
def list_waiver_claims(
    league: League = Depends(_get_league_or_404),
    only_pending: bool = Query(default=True),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_admin_role(UserRole.ADMIN)),
):
    return services.list_waiver_claims_for_league(db, league.id, only_pending=only_pending)


@router.get(
    "/leagues/{league_id}/transfers",
    response_model=list[AdminTransferItem],
    summary="List a league's transfers (admin)",
)
def list_transfers(
    league: League = Depends(_get_league_or_404),
    only_reversible: bool = Query(default=False),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_admin_role(UserRole.ADMIN)),
):
    return services.list_transfers_for_league(db, league.id, only_reversible=only_reversible)


# ── Scoring rules (admin-editable, config-driven scoring) ──────────────────────

@router.get("/scoring-rules", response_model=ScoringRuleListResponse,
            summary="List scoring rules (admin)")
def list_scoring_rules(
    sport_id: uuid.UUID | None = Query(default=None),
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_admin_role(UserRole.ADMIN)),
):
    rules = services.list_scoring_rules(db, sport_id)
    return ScoringRuleListResponse(
        rules=[ScoringRuleResponse.model_validate(r) for r in rules], total=len(rules),
    )


@router.post("/scoring-rules", response_model=ScoringRuleResponse, status_code=201,
             summary="Create a scoring rule (admin)")
def create_scoring_rule(
    data: ScoringRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role(UserRole.ADMIN)),
):
    return ScoringRuleResponse.model_validate(services.create_scoring_rule(db, current_user, data))


@router.put("/scoring-rules/{rule_id}", response_model=ScoringRuleResponse,
            summary="Update a scoring rule's value/mode/param (admin)")
def update_scoring_rule(
    rule_id: uuid.UUID,
    data: ScoringRuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role(UserRole.ADMIN)),
):
    return ScoringRuleResponse.model_validate(services.update_scoring_rule(db, current_user, rule_id, data))


@router.delete("/scoring-rules/{rule_id}", status_code=204,
               summary="Delete a scoring rule (admin)")
def delete_scoring_rule(
    rule_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_role(UserRole.ADMIN)),
):
    services.delete_scoring_rule(db, current_user, rule_id)

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.admin.models import AdminActionType
from app.auth.models import UserRole
from app.league.models import LeagueStatus
from app.support.models import TicketCategory, TicketPriority, TicketStatus
from app.support.schemas import TicketMessageResponse


# ── Users ───────────────────────────────────────────────────────────────────────

class AdminUserListItem(BaseModel):
    id: uuid.UUID
    username: str
    email: str
    role: UserRole
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminUserListResponse(BaseModel):
    items: list[AdminUserListItem]
    total: int
    page: int
    page_size: int
    has_next: bool


class AdminUserDetail(AdminUserListItem):
    auth_provider: str
    avatar_url: str | None = None


class RoleChangeRequest(BaseModel):
    role: UserRole
    reason: str | None = Field(default=None, max_length=1000)


# ── Leagues ─────────────────────────────────────────────────────────────────────

class AdminLeagueListItem(BaseModel):
    id: uuid.UUID
    name: str
    status: LeagueStatus
    owner_id: uuid.UUID
    owner_username: str
    is_public: bool
    draft_mode: bool
    created_at: datetime


class AdminLeagueListResponse(BaseModel):
    items: list[AdminLeagueListItem]
    total: int
    page: int
    page_size: int
    has_next: bool


class LeagueStatusOverrideRequest(BaseModel):
    new_status: LeagueStatus
    reason: str | None = Field(default=None, max_length=1000)


class LeagueSettingsOverrideRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    is_public: bool | None = None
    reason: str | None = Field(default=None, max_length=1000)


class AdminActionReason(BaseModel):
    reason: str | None = Field(default=None, max_length=1000)


# ── Seasons ─────────────────────────────────────────────────────────────────────

class SeasonCreateRequest(BaseModel):
    sport_id: uuid.UUID
    name: str = Field(min_length=1, max_length=100)
    start_date: date
    end_date: date
    # Human-facing cross-sport cycle label ("2026/27"), display/admin-UX
    # only — never read by cross-sport matching logic (LeagueSport.season_id
    # is the actual source of truth, see window_locator.py).
    label: str | None = Field(default=None, max_length=20)
    reason: str | None = Field(default=None, max_length=1000)


class UnifiedSeasonCreateRequest(BaseModel):
    # A unified multisport season composes 2+ sports. Its dates are NOT supplied
    # — they are derived server-side as the overlap of the component sports'
    # current seasons (later start → earlier end), so create + compete are bound
    # to the real multisport window. See UNIFIED_MULTISPORT_SCHEDULE_PLAN.md §6.
    component_sport_ids: list[uuid.UUID] = Field(min_length=2)
    name: str = Field(min_length=1, max_length=100)
    label: str | None = Field(default=None, max_length=20)
    reason: str | None = Field(default=None, max_length=1000)


class SeasonUpdateRequest(BaseModel):
    # No sport_id — a season's sport is immutable after creation (windows
    # and league scoring are keyed to it).
    name: str | None = Field(default=None, min_length=1, max_length=100)
    start_date: date | None = None
    end_date: date | None = None
    label: str | None = Field(default=None, max_length=20)
    is_active: bool | None = None
    reason: str | None = Field(default=None, max_length=1000)


class SeasonGenerateWindowsRequest(BaseModel):
    transfer_day: int = Field(ge=1, le=7)
    reason: str | None = Field(default=None, max_length=1000)


# ── Scoring ─────────────────────────────────────────────────────────────────────

class ScoringRecalculateResponse(BaseModel):
    football_players_updated: int = 0
    cricket_players_updated: int = 0
    basketball_players_updated: int = 0
    skipped: bool = False
    reason: str | None = None


class WindowLockRequest(BaseModel):
    transfers_locked: bool | None = None
    lineup_locked: bool | None = None
    reason: str | None = Field(default=None, max_length=1000)


class TransferWindowLockResponse(BaseModel):
    id: uuid.UUID
    transfers_locked: bool
    lineup_locked: bool

    model_config = ConfigDict(from_attributes=True)


# ── Players / pricing ───────────────────────────────────────────────────────────

class AdminPlayerDetail(BaseModel):
    id: uuid.UUID
    name: str
    position: str
    real_team: str
    cost: float
    is_available: bool
    photo_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


class AdminPlayerEditRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    position: str | None = Field(default=None, min_length=1, max_length=20)
    cost: float | None = Field(default=None, gt=0)
    is_available: bool | None = None
    photo_url: str | None = Field(default=None, max_length=500)
    reason: str | None = Field(default=None, max_length=1000)


class RepriceRequest(BaseModel):
    lookback_windows: int = Field(default=3, ge=1, le=10)
    reason: str | None = Field(default=None, max_length=1000)


class RepriceResponse(BaseModel):
    lookback_windows: int
    evaluated: int
    updated: int
    unchanged: int


# ── Transactions (trades / waivers / transfers) ─────────────────────────────────

class TradeActionResponse(BaseModel):
    id: str
    status: str


class WaiverClaimCancelResponse(BaseModel):
    id: str
    status: str


class TransferReverseResponse(BaseModel):
    transfer_id: str
    reversed: bool


# ── Job visibility ───────────────────────────────────────────────────────────────

class CeleryTaskInfo(BaseModel):
    worker: str
    task: str | None = None
    id: str | None = None


class CeleryBeatEntry(BaseModel):
    name: str
    task: str
    schedule: str


class CeleryJobsResponse(BaseModel):
    workers_online: list[str]
    active: list[CeleryTaskInfo]
    scheduled: list[CeleryTaskInfo]
    reserved: list[CeleryTaskInfo]
    beat_schedule: list[CeleryBeatEntry]
    locks_held: list[str]
    inspect_reachable: bool


class KafkaWorkerStatus(BaseModel):
    name: str
    alive: bool
    last_seen_seconds_ago: float | None = None


class KafkaJobsResponse(BaseModel):
    workers: list[KafkaWorkerStatus]


# ── System config / feature flags ───────────────────────────────────────────────

class SystemConfigResponse(BaseModel):
    key: str
    value: dict
    description: str | None = None
    updated_by_user_id: uuid.UUID | None = None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FeatureFlagToggleRequest(BaseModel):
    enabled: bool
    reason: str | None = Field(default=None, max_length=1000)


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


# ── Support tickets ──────────────────────────────────────────────────────────────

class AdminTicketListItem(BaseModel):
    id: uuid.UUID
    reporter_user_id: uuid.UUID
    reporter_username: str
    league_id: uuid.UUID | None
    subject: str
    category: TicketCategory
    priority: TicketPriority
    status: TicketStatus
    assigned_admin_user_id: uuid.UUID | None
    assigned_admin_username: str | None
    created_at: datetime
    updated_at: datetime


class AdminTicketListResponse(BaseModel):
    items: list[AdminTicketListItem]
    total: int
    page: int
    page_size: int
    has_next: bool


class AdminTicketDetail(AdminTicketListItem):
    resolved_at: datetime | None
    messages: list[TicketMessageResponse]


class TicketUpdateRequest(BaseModel):
    status: TicketStatus | None = None
    priority: TicketPriority | None = None
    assigned_admin_user_id: uuid.UUID | None = None
    reason: str | None = Field(default=None, max_length=1000)


class AdminTicketMessageCreateRequest(BaseModel):
    body: str = Field(min_length=1)
    is_internal_note: bool = False


# ── Browse endpoints for the Scoring/Transactions pickers ──────────────────────

class AdminTransferWindowItem(BaseModel):
    id: uuid.UUID
    number: int
    start_at: datetime
    end_at: datetime
    transfers_locked: bool
    lineup_locked: bool

    model_config = ConfigDict(from_attributes=True)


class AdminTradeItem(BaseModel):
    id: uuid.UUID
    from_team_name: str
    to_team_name: str
    status: str
    offered_count: int
    requested_count: int
    created_at: datetime


class AdminWaiverClaimItem(BaseModel):
    id: uuid.UUID
    team_name: str
    add_player_name: str
    drop_player_name: str
    status: str
    claim_priority: int
    created_at: datetime


class AdminTransferItem(BaseModel):
    id: uuid.UUID
    team_name: str
    player_out_name: str
    player_in_name: str
    cost_at_transfer: float
    reversed_at: datetime | None
    created_at: datetime


# ── Scoring rules (admin-editable scoring config) ──────────────────────────────

class ScoringRuleResponse(BaseModel):
    id: uuid.UUID
    sport_id: uuid.UUID
    action: str
    position: str | None
    mode: str
    param: float | None
    points: float
    description: str
    model_config = ConfigDict(from_attributes=True)


class ScoringRuleListResponse(BaseModel):
    rules: list[ScoringRuleResponse]
    total: int


class ScoringRuleCreate(BaseModel):
    sport_id: uuid.UUID
    action: str = Field(min_length=1, max_length=50)
    position: str | None = Field(default=None, max_length=3)
    mode: str = Field(default="per_unit")  # per_unit | per_n | threshold | flat
    param: float | None = None
    points: float
    description: str = Field(min_length=1, max_length=200)


class ScoringRuleUpdate(BaseModel):
    # Only the tunable fields — action/position/sport identify the rule and
    # don't change (delete + recreate to re-key).
    points: float | None = None
    mode: str | None = None
    param: float | None = None
    description: str | None = Field(default=None, max_length=200)

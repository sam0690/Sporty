import enum
import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Index, String, func
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


# ── System config (runtime feature-flag overrides) ─────────────────────────────

class SystemConfig(Base):
    """Runtime override layer on top of the env-driven Settings booleans in
    app/core/config.py — NOT a replacement for them. app/admin/feature_flags.py
    checks this table first and falls back to settings.<KEY> when no row
    exists (or the DB is unreachable). Only flags that are actually read at
    request/task time belong here — flags wired at process startup (e.g. the
    Kafka producer/MatchScheduler lifespan block in app/main.py) can't take
    effect from a DB row without a restart, so changing this table for those
    only affects the *next* process start, not the current one."""

    __tablename__ = "system_config"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON, nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    updated_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


# ── Admin action type enum ─────────────────────────────────────────────────────

class AdminActionType(str, enum.Enum):
    USER_SUSPEND = "user_suspend"
    USER_REACTIVATE = "user_reactivate"
    USER_FORCE_LOGOUT = "user_force_logout"
    USER_ROLE_CHANGE = "user_role_change"
    LEAGUE_STATUS_OVERRIDE = "league_status_override"
    LEAGUE_DELETE_OVERRIDE = "league_delete_override"
    LEAGUE_SETTINGS_OVERRIDE = "league_settings_override"
    SCORING_RECALCULATE = "scoring_recalculate"
    SCORING_WINDOW_LOCK = "scoring_window_lock"
    SCORING_WINDOW_UNLOCK = "scoring_window_unlock"
    PLAYER_PRICE_OVERRIDE = "player_price_override"
    PLAYER_DATA_EDIT = "player_data_edit"
    TRANSFER_REVERSE = "transfer_reverse"
    WAIVER_OVERRIDE = "waiver_override"
    TRADE_VETO_OVERRIDE = "trade_veto_override"
    TRADE_CANCEL_OVERRIDE = "trade_cancel_override"
    FEATURE_FLAG_TOGGLE = "feature_flag_toggle"
    TICKET_RESOLVE = "ticket_resolve"


# ── Admin audit log ─────────────────────────────────────────────────────────────

class AdminAuditLog(Base):
    """Append-only record of every admin action. No update/delete path is
    ever exposed — rows are written once by record_admin_action() and read
    back only for display."""

    __tablename__ = "admin_audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # ondelete="RESTRICT": an audit row must never be silently orphaned by
    # deleting the actor; actor_username_snapshot keeps the row displayable
    # even if the actor account is later renamed or (in some other flow) removed.
    actor_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    actor_username_snapshot: Mapped[str] = mapped_column(String(50), nullable=False)

    action: Mapped[AdminActionType] = mapped_column(
        SAEnum(AdminActionType, name="adminactiontype_enum", values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )

    target_type: Mapped[str] = mapped_column(String(50), nullable=False)
    target_id: Mapped[str] = mapped_column(String(255), nullable=False)

    reason: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        Index("ix_admin_audit_logs_target", "target_type", "target_id"),
        Index("ix_admin_audit_logs_actor_created", "actor_user_id", "created_at"),
    )

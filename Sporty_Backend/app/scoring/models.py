import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# NOTE: No import of league.models here — relationships use string
# targets ("League", "Sport") resolved lazily by SQLAlchemy.


# ═══════════════════════════════════════════════════════════════════════════════
# DefaultScoringRule
# ═══════════════════════════════════════════════════════════════════════════════
#
# The canonical, platform-wide list of every scoreable action per sport,
# managed by platform admins. `description` is a human-readable explanation
# for the admin UI (e.g. action="yellow_card" description="Yellow card
# received (-1)") — without it, "clean_sheet_def" is meaningless at a glance.


class DefaultScoringRule(Base):
    __tablename__ = "default_scoring_rules"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Which sport this rule applies to
    # No ondelete — block sport deletion if rules reference it
    sport_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sports.id"),
        nullable=False, index=True,
    )

    # Machine-readable action key: "goal_fwd", "assist", "clean_sheet", "yellow_card"
    action: Mapped[str] = mapped_column(String(50), nullable=False)

    # Points awarded (negative allowed — e.g. yellow_card = -1.0)
    points: Mapped[Decimal] = mapped_column(
        Numeric(precision=6, scale=2), nullable=False
    )

    # Human-readable explanation for admin UI
    # e.g. "Goal scored by a forward (+10 pts)"
    description: Mapped[str] = mapped_column(String(200), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Admins WILL change default point values over time (e.g. rebalancing
    # scoring mid-season). updated_at tracks when a rule was last modified
    # for auditing purposes.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    # Relationships
    sport: Mapped["Sport"] = relationship(foreign_keys=[sport_id])

    __table_args__ = (
        # One rule per action per sport — no duplicate "goal_fwd" for football
        UniqueConstraint("sport_id", "action", name="uq_default_rule_sport_action"),
    )

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    func,
    text,
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

    # Machine-readable action key: "goal", "assist", "clean_sheet", "save",
    # "penalty_save", "defensive_contribution", "yellow_card". Position variance
    # is carried by the `position` column below, NOT baked into the action key.
    action: Mapped[str] = mapped_column(String(50), nullable=False)

    # Position this rule applies to: "GK" | "DEF" | "MID" | "FWD". NULL = every
    # position (assist, cards, own goals — value doesn't vary by position). This
    # is what makes scoring position-aware without hardcoding: a GK goal and a
    # FWD goal are two rows of the same `action` with different points.
    position: Mapped[str | None] = mapped_column(String(3), nullable=True)

    # How `points` is applied to the action's metric count (see
    # football_engine.METRIC_RESOLVERS for what each action counts):
    #   per_unit  — count * points            (goal, assist, clean_sheet)
    #   per_n     — (count // param) * points  (save: 1 per 3; conceded: -1 per 2)
    #   threshold — points if count >= param   (defensive_contribution: 2 @ 10)
    #   flat      — points once if count > 0
    # Keeps the FORMULA data-driven, not just the values — admins add/retune
    # actions without a deploy.
    mode: Mapped[str] = mapped_column(String(12), nullable=False, default="per_unit")

    # The N for per_n / the minimum for threshold. NULL for per_unit / flat.
    param: Mapped[Decimal | None] = mapped_column(
        Numeric(precision=6, scale=2), nullable=True
    )

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
        # One rule per (action, position) per sport. COALESCE so the NULL
        # (all-positions) variant is a single slot that can't collide, while
        # GK/DEF/MID/FWD variants of the same action coexist.
        Index(
            "uq_default_rule_sport_action_pos",
            "sport_id",
            "action",
            text("COALESCE(position, '')"),
            unique=True,
        ),
    )

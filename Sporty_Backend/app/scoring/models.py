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
# 1. DefaultScoringRule
# ═══════════════════════════════════════════════════════════════════════════════
#
# Q: Why does `description` belong on DefaultScoringRule
#    but NOT on LeagueScoringOverride?
#
# A: Different audiences and management patterns:
#
#    DefaultScoringRule is managed by PLATFORM ADMINS.
#    It's the canonical list of every scoreable action per sport.
#    Admins see this in an admin dashboard and need a human-readable
#    description to understand what each action means:
#      action="goal_fwd"  description="Goal scored by a forward (+10)"
#      action="yellow_card"  description="Yellow card received (-1)"
#    Without description, a non-technical admin staring at "clean_sheet_def"
#    has no idea what points value to assign.
#
#    LeagueScoringOverride is managed by LEAGUE OWNERS.
#    They pick from the list of DefaultScoringRule actions (shown with
#    their descriptions in the UI) and only override the `points` value.
#    The override doesn't need its own description because:
#      1. The description already lives on the default rule — the UI
#         JOINs to display it.
#      2. If an override had its own description, it would diverge from
#         the canonical one, creating inconsistency ("Goal by forward"
#         vs "FWD goal" vs "Forward scores").
#      3. Overrides are just (action, points) tuples — minimal data,
#         single responsibility.
#
#    In short: DefaultScoringRule = "what actions exist and what they mean"
#              LeagueScoringOverride = "how much is this action worth in MY league"


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


# ═══════════════════════════════════════════════════════════════════════════════
# 2. LeagueScoringOverride
# ═══════════════════════════════════════════════════════════════════════════════
#
# Q: What happens to overrides when a league is deleted?
#    What CASCADE behavior is correct and why?
#
# A: CASCADE (ondelete="CASCADE") on league_id. Reasoning:
#
#    Overrides are league-owned configuration — they have no meaning
#    outside the league they belong to. If league "Champions 2025" is
#    deleted, its custom scoring rules ("goal_fwd = 12 pts") are
#    meaningless orphans. They should be cleaned up automatically.
#
#    This is the same pattern as LeagueSport, LineupSlot, and
#    LeagueMembership — all league child config tables CASCADE.
#
#    For sport_id: NO CASCADE. Deleting a sport should be blocked if
#    any scoring overrides reference it (same pattern as everywhere
#    else — sports are soft-disabled via is_active, not deleted).
#
#    No description column — see Q1 answer above.


class LeagueScoringOverride(Base):
    __tablename__ = "league_scoring_overrides"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # CASCADE — overrides die with the league (see Q above)
    league_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leagues.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    # No CASCADE — block sport deletion if overrides reference it
    sport_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sports.id"),
        nullable=False, index=True,
    )

    # Must match an action from DefaultScoringRule (validated at service layer)
    action: Mapped[str] = mapped_column(String(50), nullable=False)

    # Overridden points for this league (negative allowed)
    points: Mapped[Decimal] = mapped_column(
        Numeric(precision=6, scale=2), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    league: Mapped["League"] = relationship(foreign_keys=[league_id])
    sport: Mapped["Sport"] = relationship(foreign_keys=[sport_id])

    __table_args__ = (
        # One override per action per sport per league
        UniqueConstraint(
            "league_id", "sport_id", "action",
            name="uq_override_league_sport_action",
        ),
    )

"""NBA stats model (basketball) — 1:1 child of PlayerGameweekStat.

Kept in a separate module so basketball can evolve independently.
Alembic env is updated to import this module.
"""

from __future__ import annotations

import uuid

from sqlalchemy import CheckConstraint, ForeignKey, SmallInteger
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# Imported for typing + relationship back_populates target.
# This does not create a circular import because app.player.models does not
# import this module.
from app.player.models import PlayerGameweekStat  # noqa: E402,F401


class NBAStat(Base):
    __tablename__ = "nba_stats"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    base_stat_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("player_gameweek_stats.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )

    points: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    assists: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    rebounds: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    steals: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    blocks: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)

    base_stat: Mapped["PlayerGameweekStat"] = relationship(
        "PlayerGameweekStat",
        back_populates="nba_stat",
    )

    __table_args__ = (
        CheckConstraint("points >= 0", name="ck_nba_points"),
        CheckConstraint("assists >= 0", name="ck_nba_assists"),
        CheckConstraint("rebounds >= 0", name="ck_nba_rebounds"),
        CheckConstraint("steals >= 0", name="ck_nba_steals"),
        CheckConstraint("blocks >= 0", name="ck_nba_blocks"),
    )

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CompetitionSnapshot(Base):
    """Display-only cache of real-competition data (standings / scorers /
    matches) from football-data.org, per (competition, season, kind).

    Deliberately separate from the `matches` table, which is the fantasy
    scoring spine — historical real results must never land there. This layer
    is read solely by the public competition pages. Current-season rows are
    refreshed daily by the sync task; historical rows are fetched on demand
    the first time a season is viewed and then never change.
    """

    __tablename__ = "competition_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # RealTeam.competition tag: "EPL" | "LALIGA" | "BUNDESLIGA"
    competition: Mapped[str] = mapped_column(String(20), nullable=False)
    # Season start year (2026 = the 2026-27 season)
    season: Mapped[int] = mapped_column(Integer, nullable=False)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)  # standings | scorers | matches
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "competition", "season", "kind", name="uq_competition_snapshot"
        ),
    )

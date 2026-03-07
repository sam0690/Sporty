"""
Match models — Real-world sports fixtures/matches.

Stores data from external APIs (API-Football, API-NBA, CricAPI) about
actual sports matches. Used to:
  1. Display upcoming fixtures to users
  2. Set lineup deadlines (before match starts)
  3. Fetch and store live/finished match stats
  4. Calculate fantasy points based on real match events
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Match(Base):
    """Real-world sports match/fixture from external APIs."""

    __tablename__ = "matches"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    sport_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sports.id", ondelete="CASCADE"), nullable=False
    )

    # External API reference (unique per sport)
    # e.g., "12345" from API-Football fixture ID
    external_api_id: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, index=True
    )

    # Teams
    home_team: Mapped[str] = mapped_column(String(100), nullable=False)
    away_team: Mapped[str] = mapped_column(String(100), nullable=False)

    # Timing
    match_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )

    # Status: "scheduled", "live", "finished", "postponed", "cancelled"
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="scheduled", index=True
    )

    # Results (null until match finishes)
    home_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    away_score: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Metadata
    competition: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # "Premier League", "NBA", "IPL"
    season: Mapped[str] = mapped_column(String(20), nullable=False)  # "2024", "2024-25"

    # Relationships
    sport: Mapped["Sport"] = relationship("Sport", back_populates="matches")

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    def __repr__(self):
        return f"<Match {self.home_team} vs {self.away_team} ({self.match_date.date()})>"

from __future__ import annotations

import uuid

from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class IngestionTeam(Base):
    __tablename__ = "ingestion_teams"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    sport: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    external_id: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    abbreviation: Mapped[str | None] = mapped_column(String(20), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    conference: Mapped[str | None] = mapped_column(String(50), nullable=True)
    division: Mapped[str | None] = mapped_column(String(50), nullable=True)

    players: Mapped[list["IngestionPlayer"]] = relationship(
        back_populates="team",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        UniqueConstraint("sport", "external_id", name="uq_ingestion_team_sport_external"),
    )


class IngestionPlayer(Base):
    __tablename__ = "ingestion_players"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    sport: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    external_id: Mapped[str] = mapped_column(String(100), nullable=False)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    first_name: Mapped[str | None] = mapped_column(String(75), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(75), nullable=True)
    position: Mapped[str | None] = mapped_column(String(30), nullable=True)
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ingestion_teams.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    team: Mapped["IngestionTeam"] = relationship(back_populates="players")

    __table_args__ = (
        UniqueConstraint("sport", "external_id", name="uq_ingestion_player_sport_external"),
    )


Team = IngestionTeam
Player = IngestionPlayer

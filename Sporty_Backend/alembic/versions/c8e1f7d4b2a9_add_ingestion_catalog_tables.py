"""add ingestion catalog tables

Revision ID: c8e1f7d4b2a9
Revises: 9f2c7b7f11a4
Create Date: 2026-05-09 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = "c8e1f7d4b2a9"
down_revision = "9f2c7b7f11a4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ingestion_teams",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("sport", sa.String(length=50), nullable=False),
        sa.Column("external_id", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("abbreviation", sa.String(length=20), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("conference", sa.String(length=50), nullable=True),
        sa.Column("division", sa.String(length=50), nullable=True),
        sa.UniqueConstraint("sport", "external_id", name="uq_ingestion_team_sport_external"),
    )
    op.create_index("ix_ingestion_teams_sport", "ingestion_teams", ["sport"], unique=False)

    op.create_table(
        "ingestion_players",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("sport", sa.String(length=50), nullable=False),
        sa.Column("external_id", sa.String(length=100), nullable=False),
        sa.Column("full_name", sa.String(length=150), nullable=False),
        sa.Column("first_name", sa.String(length=75), nullable=True),
        sa.Column("last_name", sa.String(length=75), nullable=True),
        sa.Column("position", sa.String(length=30), nullable=True),
        sa.Column(
            "team_id",
            UUID(as_uuid=True),
            sa.ForeignKey("ingestion_teams.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("sport", "external_id", name="uq_ingestion_player_sport_external"),
    )
    op.create_index("ix_ingestion_players_sport", "ingestion_players", ["sport"], unique=False)
    op.create_index("ix_ingestion_players_team_id", "ingestion_players", ["team_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_ingestion_players_team_id", table_name="ingestion_players")
    op.drop_index("ix_ingestion_players_sport", table_name="ingestion_players")
    op.drop_table("ingestion_players")
    op.drop_index("ix_ingestion_teams_sport", table_name="ingestion_teams")
    op.drop_table("ingestion_teams")

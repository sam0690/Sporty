"""add teamplayer sport_type and autopick support

Revision ID: 4b5c6d7e8f90
Revises: 1d4c6b7e9f01
Create Date: 2026-05-29 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "4b5c6d7e8f90"
down_revision: Union[str, Sequence[str], None] = "1d4c6b7e9f01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "team_players",
        sa.Column("sport_type", sa.String(length=20), nullable=True),
    )
    op.execute(
        """
        UPDATE team_players tp
        SET sport_type = s.name
        FROM players p
        JOIN sports s ON s.id = p.sport_id
        WHERE tp.player_id = p.id AND tp.sport_type IS NULL
        """
    )
    op.alter_column("team_players", "sport_type", nullable=False)
    op.create_index(
        op.f("ix_team_players_sport_type"),
        "team_players",
        ["sport_type"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_team_players_sport_type"), table_name="team_players")
    op.drop_column("team_players", "sport_type")
"""add fantasy team config snapshots

Revision ID: d9e1f0a2b3c4
Revises: c7d8e9f1a2b3
Create Date: 2026-05-27 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d9e1f0a2b3c4"
down_revision: Union[str, Sequence[str], None] = "c7d8e9f1a2b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "fantasy_teams",
        sa.Column("starting_budget", sa.Numeric(precision=12, scale=2), nullable=True),
    )
    op.add_column(
        "fantasy_teams",
        sa.Column("starting_squad_size", sa.SmallInteger(), nullable=True),
    )

    op.execute(
        sa.text(
            """
            UPDATE fantasy_teams
            SET starting_budget = (
                SELECT leagues.budget_per_team
                FROM leagues
                WHERE leagues.id = fantasy_teams.league_id
            ),
            starting_squad_size = (
                SELECT leagues.squad_size
                FROM leagues
                WHERE leagues.id = fantasy_teams.league_id
            )
            """
        )
    )

    op.alter_column("fantasy_teams", "starting_budget", nullable=False)
    op.alter_column("fantasy_teams", "starting_squad_size", nullable=False)


def downgrade() -> None:
    op.drop_column("fantasy_teams", "starting_squad_size")
    op.drop_column("fantasy_teams", "starting_budget")
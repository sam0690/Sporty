"""add membership and team status fields

Revision ID: c7d8e9f1a2b3
Revises: a12d9f4c8b77
Create Date: 2026-05-27 00:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c7d8e9f1a2b3"
down_revision: Union[str, Sequence[str], None] = "a12d9f4c8b77"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "league_memberships",
        sa.Column(
            "status",
            sa.Enum(
                "active",
                "left",
                name="league_membership_status_enum",
                native_enum=False,
            ),
            nullable=False,
            server_default=sa.text("'active'"),
        ),
    )
    op.create_index(
        "ix_league_memberships_status",
        "league_memberships",
        ["status"],
        unique=False,
    )

    op.add_column(
        "fantasy_teams",
        sa.Column(
            "status",
            sa.Enum(
                "active",
                "archived",
                name="fantasy_team_status_enum",
                native_enum=False,
            ),
            nullable=False,
            server_default=sa.text("'active'"),
        ),
    )
    op.create_index(
        "ix_fantasy_teams_status",
        "fantasy_teams",
        ["status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_fantasy_teams_status", table_name="fantasy_teams")
    op.drop_column("fantasy_teams", "status")

    op.drop_index("ix_league_memberships_status", table_name="league_memberships")
    op.drop_column("league_memberships", "status")

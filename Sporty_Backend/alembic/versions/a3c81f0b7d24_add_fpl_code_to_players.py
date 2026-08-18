"""add fpl_code to players

Stores the Fantasy Premier League element `code` so official studio headshots
can be fetched by a stable id instead of re-running a name match on every
photo refresh. Nullable: FPL only covers the Premier League, so La Liga and
Bundesliga players legitimately have none.

Revision ID: a3c81f0b7d24
Revises: d1f4b7c9e35a
Create Date: 2026-08-18
"""
from alembic import op
import sqlalchemy as sa

revision = "a3c81f0b7d24"
down_revision = "d1f4b7c9e35a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("players", sa.Column("fpl_code", sa.Integer(), nullable=True))
    op.create_index("ix_players_fpl_code", "players", ["fpl_code"])


def downgrade() -> None:
    op.drop_index("ix_players_fpl_code", table_name="players")
    op.drop_column("players", "fpl_code")

"""add player filter indexes

Revision ID: c1f2e3d4b5a6
Revises: zz_twx_excl_20260501
Create Date: 2026-05-24 00:00:00.000000
"""

from __future__ import annotations

from alembic import op


# revision identifiers, used by Alembic.
revision = "c1f2e3d4b5a6"
down_revision = "zz_twx_excl_20260501"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.create_index("ix_players_position", "players", ["position"], unique=False)
    op.create_index("ix_players_cost", "players", ["cost"], unique=False)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_players_name_trgm ON players USING gin (lower(name) gin_trgm_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_players_name_trgm")
    op.drop_index("ix_players_cost", table_name="players")
    op.drop_index("ix_players_position", table_name="players")
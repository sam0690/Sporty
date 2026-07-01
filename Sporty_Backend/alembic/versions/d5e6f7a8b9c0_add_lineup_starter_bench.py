"""add is_starter + bench_order to team_gameweek_lineups

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-07-01 12:00:00.000000

Why:
  Fantasy team scoring must use the starting lineup only, with FPL-style
  auto-substitution of bench players for starters who play 0 minutes. To do
  that the bench has to be stored (previously only starters were persisted to
  team_gameweek_lineups) with an explicit priority order.

  This migration adds:
    - is_starter  (bool, NOT NULL, default TRUE) — starter vs bench flag.
    - bench_order (smallint, NULL) — auto-sub priority (0 = first sub on),
      NULL for starters.

  Every existing row was a starter, so the TRUE server_default backfills them
  correctly with no data migration needed.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision = "d5e6f7a8b9c0"
down_revision = "c4d5e6f7a8b9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "team_gameweek_lineups",
        sa.Column(
            "is_starter",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )
    op.add_column(
        "team_gameweek_lineups",
        sa.Column("bench_order", sa.SmallInteger(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("team_gameweek_lineups", "bench_order")
    op.drop_column("team_gameweek_lineups", "is_starter")

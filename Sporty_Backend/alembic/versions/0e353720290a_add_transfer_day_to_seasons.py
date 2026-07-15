"""add transfer_day to seasons

Revision ID: 0e353720290a
Revises: 72af12eca7be
Create Date: 2026-07-15 15:00:00.000000

Why:
  Transfer window generation is moving from a per-league, owner-triggered
  action to a season-scoped, admin-owned one (windows are already shared by
  every league on a season; only generation ownership was mismatched). This
  adds the column the new season-scoped generator persists the chosen
  weekday to, plus the matching admin-audit action type. Nullable: a season
  can exist before an admin generates windows for it (two-step admin flow,
  same shape as create-league then generate-windows). League.transfer_day is
  left in place but unused.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0e353720290a'
down_revision: Union[str, Sequence[str], None] = '72af12eca7be'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('seasons', sa.Column('transfer_day', sa.SmallInteger(), nullable=True))
    op.create_check_constraint(
        'ck_season_transfer_day',
        'seasons',
        'transfer_day IS NULL OR (transfer_day >= 1 AND transfer_day <= 7)',
    )
    # ADD VALUE can't run in the same transaction as a statement that USES
    # the new value, but nothing else in this migration does — same pattern
    # as 56d203ba3d99_add_season_update_admin_action_type.py.
    op.execute("ALTER TYPE adminactiontype_enum ADD VALUE IF NOT EXISTS 'season_generate_windows'")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('ck_season_transfer_day', 'seasons', type_='check')
    op.drop_column('seasons', 'transfer_day')
    # Postgres can't cheaply remove a value from an existing enum type — no-op,
    # same as the season_update precedent.

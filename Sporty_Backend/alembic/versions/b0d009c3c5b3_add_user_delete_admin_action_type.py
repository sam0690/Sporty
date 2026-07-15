"""add user_delete admin action type

Revision ID: b0d009c3c5b3
Revises: 0e353720290a
Create Date: 2026-07-15 16:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b0d009c3c5b3'
down_revision: Union[str, Sequence[str], None] = '0e353720290a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # ADD VALUE can't run in the same transaction as a statement that USES
    # the new value, but nothing else in this migration does — same pattern
    # as 56d203ba3d99_add_season_update_admin_action_type.py.
    op.execute("ALTER TYPE adminactiontype_enum ADD VALUE IF NOT EXISTS 'user_delete'")


def downgrade() -> None:
    """Downgrade schema."""
    # Postgres can't cheaply remove a value from an existing enum type — no-op,
    # same as the season_update precedent.

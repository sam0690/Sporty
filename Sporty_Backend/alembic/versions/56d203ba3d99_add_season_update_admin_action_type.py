"""add season_update admin action type

Revision ID: 56d203ba3d99
Revises: f79c3e8b85c2
Create Date: 2026-07-12 03:37:47.219014

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '56d203ba3d99'
down_revision: Union[str, Sequence[str], None] = 'f79c3e8b85c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # ADD VALUE can't run in the same transaction as a statement that USES
    # the new value, but nothing else in this migration does, so this is
    # safe inside alembic's single-transaction migration (same pattern as
    # 9f4a2b6e1d3c_add_support_tickets.py's ticket_update/ticket_assign).
    op.execute("ALTER TYPE adminactiontype_enum ADD VALUE IF NOT EXISTS 'season_update'")


def downgrade() -> None:
    """Downgrade schema."""
    # Postgres can't cheaply remove a value from an existing enum type — no-op,
    # same as the ticket_update/ticket_assign precedent.
    pass

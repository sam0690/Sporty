"""add player_create admin action type

Revision ID: c7e91a4b2f08
Revises: a3c81f0b7d24
Create Date: 2026-08-19 22:10:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'c7e91a4b2f08'
down_revision: Union[str, Sequence[str], None] = 'a3c81f0b7d24'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Admin-created pool entries are audited distinctly from edits: a creation
    # has no `before` state, and "who put this player in the pool" is the
    # question the audit log gets asked. Same single-transaction caveat and
    # precedent as 56d203ba3d99 / 9f4a2b6e1d3c — nothing here USES the value.
    op.execute("ALTER TYPE adminactiontype_enum ADD VALUE IF NOT EXISTS 'player_create'")


def downgrade() -> None:
    """Downgrade schema."""
    # Postgres can't cheaply remove a value from an existing enum type — no-op,
    # same as the season_update / ticket_update precedent.
    pass

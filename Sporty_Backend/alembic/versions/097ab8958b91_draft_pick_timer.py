"""draft pick timer

Revision ID: 097ab8958b91
Revises: da53bd8a49b2
Create Date: 2026-07-12 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '097ab8958b91'
down_revision: Union[str, Sequence[str], None] = 'da53bd8a49b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # server_default so this cleanly backfills existing rows on a populated table.
    op.add_column('leagues', sa.Column('draft_pick_seconds', sa.SmallInteger(), nullable=False, server_default=sa.text('90')))
    op.add_column('leagues', sa.Column('draft_pick_deadline_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('leagues', 'draft_pick_deadline_at')
    op.drop_column('leagues', 'draft_pick_seconds')

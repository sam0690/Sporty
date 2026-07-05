"""add transfer reversed_at

Revision ID: c45a5f0cc3de
Revises: 7fe39280778f
Create Date: 2026-07-05 16:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c45a5f0cc3de'
down_revision: Union[str, Sequence[str], None] = '7fe39280778f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'transfers',
        sa.Column('reversed_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('transfers', 'reversed_at')

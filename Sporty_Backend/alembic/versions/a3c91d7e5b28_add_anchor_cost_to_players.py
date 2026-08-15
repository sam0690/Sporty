"""add anchor_cost to players

Revision ID: a3c91d7e5b28
Revises: e6a8c0d2f4b5
Create Date: 2026-08-15

The fixed reference price repricing is allowed to drift away from, bounded by
MAX_DRIFT_FROM_ANCHOR in app/services/pricing/repricing.py. Nullable and left
NULL here — scripts/reseed_prices_from_fpl.py populates it, and repricing
falls back to the raw policy min/max bounds while it is NULL, so this
migration is behaviour-neutral on its own.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3c91d7e5b28'
down_revision: Union[str, Sequence[str], None] = 'e6a8c0d2f4b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'players',
        sa.Column('anchor_cost', sa.Numeric(precision=10, scale=2), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('players', 'anchor_cost')

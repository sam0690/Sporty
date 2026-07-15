"""add demand_score to player_price_history

Revision ID: 72af12eca7be
Revises: d4e8f1a2b3c6
Create Date: 2026-07-15 14:16:45.554495

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '72af12eca7be'
down_revision: Union[str, Sequence[str], None] = 'd4e8f1a2b3c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Note: autogenerate also picked up unrelated pre-existing drift
    # (ix_match_feed_cache_match_id, ix_players_name_trgm, ix_real_teams_
    # external_api_id) between models.py and the deployed DB — deliberately
    # left out of this migration, which is scoped to demand_score only.
    op.add_column('player_price_history', sa.Column('demand_score', sa.Numeric(precision=5, scale=4), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('player_price_history', 'demand_score')

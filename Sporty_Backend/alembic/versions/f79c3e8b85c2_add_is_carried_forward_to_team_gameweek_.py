"""add is_carried_forward to team_gameweek_lineups

Revision ID: f79c3e8b85c2
Revises: ddcce5d42741
Create Date: 2026-07-10 19:51:42.045279

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f79c3e8b85c2'
down_revision: Union[str, Sequence[str], None] = 'ddcce5d42741'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Note: autogenerate also detected unrelated pre-existing drift (indexes
    # on match_feed_cache/players/real_teams not declared in these models) -
    # intentionally left out of this migration, which only adds the new
    # is_carried_forward column.
    op.add_column('team_gameweek_lineups', sa.Column('is_carried_forward', sa.Boolean(), server_default=sa.text('false'), nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('team_gameweek_lineups', 'is_carried_forward')

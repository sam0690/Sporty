"""add nba_stats table

Revision ID: 4d7296a4da76
Revises: 025e80bbd3b6
Create Date: 2026-03-17 23:13:27.826623

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4d7296a4da76'
down_revision: Union[str, Sequence[str], None] = '025e80bbd3b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'nba_stats',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('base_stat_id', sa.UUID(), nullable=False),
        sa.Column('points', sa.SmallInteger(), nullable=False, server_default='0'),
        sa.Column('assists', sa.SmallInteger(), nullable=False, server_default='0'),
        sa.Column('rebounds', sa.SmallInteger(), nullable=False, server_default='0'),
        sa.Column('steals', sa.SmallInteger(), nullable=False, server_default='0'),
        sa.Column('blocks', sa.SmallInteger(), nullable=False, server_default='0'),
        sa.CheckConstraint('points >= 0', name='ck_nba_points'),
        sa.CheckConstraint('assists >= 0', name='ck_nba_assists'),
        sa.CheckConstraint('rebounds >= 0', name='ck_nba_rebounds'),
        sa.CheckConstraint('steals >= 0', name='ck_nba_steals'),
        sa.CheckConstraint('blocks >= 0', name='ck_nba_blocks'),
        sa.ForeignKeyConstraint(
            ['base_stat_id'],
            ['player_gameweek_stats.id'],
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('base_stat_id'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('nba_stats')

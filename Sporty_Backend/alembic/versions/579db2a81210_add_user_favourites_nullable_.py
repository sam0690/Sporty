"""add user favourites, nullable notification league_id

Revision ID: 579db2a81210
Revises: 6c54fdd27e4d
Create Date: 2026-07-07 21:45:38.613888

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '579db2a81210'
down_revision: Union[str, Sequence[str], None] = '6c54fdd27e4d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# NOTE: autogenerate also proposed dropping/recreating an index on
# match_feed_cache/players and adding one on real_teams — pre-existing
# index-level drift unrelated to this change (unlike the earlier
# league_scoring_overrides migration, this is NOT a table-drop risk; it's
# just a couple of indexes not perfectly matching their model declarations).
# Deliberately excluded; trimmed by hand to only the favourites + nullable
# notifications.league_id change.


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column('notifications', 'league_id',
               existing_type=sa.UUID(),
               nullable=True)
    op.add_column('users', sa.Column('favourite_team_id', sa.UUID(), nullable=True))
    op.add_column('users', sa.Column('favourite_player_id', sa.UUID(), nullable=True))
    op.create_index(op.f('ix_users_favourite_player_id'), 'users', ['favourite_player_id'], unique=False)
    op.create_index(op.f('ix_users_favourite_team_id'), 'users', ['favourite_team_id'], unique=False)
    op.create_foreign_key(None, 'users', 'players', ['favourite_player_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key(None, 'users', 'real_teams', ['favourite_team_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(None, 'users', type_='foreignkey')
    op.drop_constraint(None, 'users', type_='foreignkey')
    op.drop_index(op.f('ix_users_favourite_team_id'), table_name='users')
    op.drop_index(op.f('ix_users_favourite_player_id'), table_name='users')
    op.drop_column('users', 'favourite_player_id')
    op.drop_column('users', 'favourite_team_id')
    op.alter_column('notifications', 'league_id',
               existing_type=sa.UUID(),
               nullable=False)

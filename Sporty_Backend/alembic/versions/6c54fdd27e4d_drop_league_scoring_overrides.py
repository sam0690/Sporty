"""drop league_scoring_overrides

Revision ID: 6c54fdd27e4d
Revises: a1b2c3d4e5f6
Create Date: 2026-07-07 20:23:32.588534

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '6c54fdd27e4d'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# NOTE: autogenerate also proposed dropping live_events, notifications, and
# match_feed_cache and touching unrelated indexes on players/real_teams —
# that's pre-existing drift between models and the DB, unrelated to this
# change. Deliberately excluded here; trimmed by hand to only the
# league_scoring_overrides removal (retiring the per-league scoring
# override feature — see app/scoring/models.py).


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_index(op.f('ix_league_scoring_overrides_league_id'), table_name='league_scoring_overrides')
    op.drop_index(op.f('ix_league_scoring_overrides_sport_id'), table_name='league_scoring_overrides')
    op.drop_table('league_scoring_overrides')


def downgrade() -> None:
    """Downgrade schema."""
    op.create_table(
        'league_scoring_overrides',
        sa.Column('id', sa.UUID(), autoincrement=False, nullable=False),
        sa.Column('league_id', sa.UUID(), autoincrement=False, nullable=False),
        sa.Column('sport_id', sa.UUID(), autoincrement=False, nullable=False),
        sa.Column('action', sa.VARCHAR(length=50), autoincrement=False, nullable=False),
        sa.Column('points', sa.NUMERIC(precision=6, scale=2), autoincrement=False, nullable=False),
        sa.Column('created_at', postgresql.TIMESTAMP(timezone=True), server_default=sa.text('now()'), autoincrement=False, nullable=False),
        sa.ForeignKeyConstraint(['league_id'], ['leagues.id'], name=op.f('league_scoring_overrides_league_id_fkey'), ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['sport_id'], ['sports.id'], name=op.f('league_scoring_overrides_sport_id_fkey')),
        sa.PrimaryKeyConstraint('id', name=op.f('league_scoring_overrides_pkey')),
        sa.UniqueConstraint('league_id', 'sport_id', 'action', name=op.f('uq_override_league_sport_action')),
    )
    op.create_index(op.f('ix_league_scoring_overrides_sport_id'), 'league_scoring_overrides', ['sport_id'], unique=False)
    op.create_index(op.f('ix_league_scoring_overrides_league_id'), 'league_scoring_overrides', ['league_id'], unique=False)

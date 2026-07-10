"""add player enrichment fields from thesportsdb

Revision ID: ddcce5d42741
Revises: dc8dfbef795d
Create Date: 2026-07-10 18:02:50.849254

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'ddcce5d42741'
down_revision: Union[str, Sequence[str], None] = 'dc8dfbef795d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Note: autogenerate also detected unrelated pre-existing drift (indexes
    # on match_feed_cache/players/real_teams not declared in these models) -
    # intentionally left out of this migration, which only adds the new
    # player enrichment columns.
    op.add_column('players', sa.Column('nationality', sa.String(length=100), nullable=True))
    op.add_column('players', sa.Column('date_of_birth', sa.Date(), nullable=True))
    op.add_column('players', sa.Column('height', sa.String(length=50), nullable=True))
    op.add_column('players', sa.Column('weight', sa.String(length=50), nullable=True))
    op.add_column('players', sa.Column('jersey_number', sa.Integer(), nullable=True))
    op.add_column('players', sa.Column('bio', sa.Text(), nullable=True))
    op.add_column('players', sa.Column('wage', sa.String(length=50), nullable=True))
    op.add_column('players', sa.Column('signing_fee', sa.String(length=50), nullable=True))
    op.add_column('players', sa.Column('date_signed', sa.Date(), nullable=True))
    op.add_column('players', sa.Column('agent', sa.String(length=150), nullable=True))
    op.add_column('players', sa.Column('social_links', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('players', 'social_links')
    op.drop_column('players', 'agent')
    op.drop_column('players', 'date_signed')
    op.drop_column('players', 'signing_fee')
    op.drop_column('players', 'wage')
    op.drop_column('players', 'bio')
    op.drop_column('players', 'jersey_number')
    op.drop_column('players', 'weight')
    op.drop_column('players', 'height')
    op.drop_column('players', 'date_of_birth')
    op.drop_column('players', 'nationality')

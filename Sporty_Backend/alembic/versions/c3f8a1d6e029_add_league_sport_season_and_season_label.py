"""add league_sports.season_id and seasons.label

Revision ID: c3f8a1d6e029
Revises: b0d009c3c5b3
Create Date: 2026-07-15 17:00:00.000000

Why:
  Cross-sport scoring for multisport leagues used to infer "which season of
  sport B pairs with this league's sport A" by exact start_date/end_date
  equality between Season rows -- which only ever holds by coincidence.
  league_sports.season_id makes that pairing an explicit, stored decision
  per league instead of an inferred one. seasons.label is a parallel,
  independent admin-facing display field ("2026/27") -- never read by the
  matching logic itself.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'c3f8a1d6e029'
down_revision: Union[str, Sequence[str], None] = 'b0d009c3c5b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('seasons', sa.Column('label', sa.String(length=20), nullable=True))
    op.add_column(
        'league_sports',
        sa.Column('season_id', postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        'fk_league_sports_season_id', 'league_sports', 'seasons',
        ['season_id'], ['id'],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('fk_league_sports_season_id', 'league_sports', type_='foreignkey')
    op.drop_column('league_sports', 'season_id')
    op.drop_column('seasons', 'label')

"""Add league_sports.competition_filter + pin legacy football leagues to EPL

NULL = pool spans all competitions. Existing football leagues were created
against an EPL-only player pool, so they are backfilled to 'EPL' — the
La Liga/Bundesliga expansion must not change their gameplay mid-season.

Revision ID: d8f2a6b3c419
Revises: c3d7e9f1a204
Create Date: 2026-07-24
"""

import sqlalchemy as sa

from alembic import op

revision = "d8f2a6b3c419"
down_revision = "c3d7e9f1a204"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "league_sports", sa.Column("competition_filter", sa.String(20), nullable=True)
    )
    op.execute(
        """
        UPDATE league_sports
        SET competition_filter = 'EPL'
        WHERE sport_id IN (SELECT id FROM sports WHERE name = 'football')
        """
    )


def downgrade() -> None:
    op.drop_column("league_sports", "competition_filter")

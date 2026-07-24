"""Add real_teams.competition tag (EPL/LALIGA/BUNDESLIGA)

Current top-flight membership of a real club — the scoping key for
competition-filtered fantasy-league player pools. NULL = not in a tracked
competition (relegated clubs, feeder test teams, NBA teams).

Revision ID: c3d7e9f1a204
Revises: f4a1b8c9d052
Create Date: 2026-07-24
"""

import sqlalchemy as sa

from alembic import op

revision = "c3d7e9f1a204"
down_revision = "f4a1b8c9d052"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("real_teams", sa.Column("competition", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("real_teams", "competition")

"""Add competition_snapshots (display-only real-competition data cache)

Standings / scorers / matches per (competition, season) from
football-data.org, read only by the public competition pages. Kept separate
from the fantasy-scoring `matches` table on purpose.

Revision ID: e4b9c1d7f320
Revises: d8f2a6b3c419
Create Date: 2026-07-24
"""

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

from alembic import op

revision = "e4b9c1d7f320"
down_revision = "d8f2a6b3c419"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "competition_snapshots",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("competition", sa.String(20), nullable=False),
        sa.Column("season", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("payload", JSONB(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "competition", "season", "kind", name="uq_competition_snapshot"
        ),
    )


def downgrade() -> None:
    op.drop_table("competition_snapshots")

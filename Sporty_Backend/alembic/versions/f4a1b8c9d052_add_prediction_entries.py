"""add prediction_entries for the Predictor game

Revision ID: f4a1b8c9d052
Revises: d7e3f9a1b024
Create Date: 2026-07-21 00:00:00.000000

One exact-score prediction per user per fixture (uq_prediction_user_match).
points_awarded is NULL until the match finishes and resolution scores it 5/3/1/0
(app/prediction/services.py). Distinct from the feeder win-probability cache.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "f4a1b8c9d052"
down_revision: Union[str, Sequence[str], None] = "d7e3f9a1b024"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "prediction_entries",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("match_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("predicted_home", sa.Integer(), nullable=False),
        sa.Column("predicted_away", sa.Integer(), nullable=False),
        sa.Column("points_awarded", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["match_id"], ["matches.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("user_id", "match_id", name="uq_prediction_user_match"),
    )
    op.create_index(
        "ix_prediction_entries_user_id", "prediction_entries", ["user_id"]
    )
    op.create_index(
        "ix_prediction_entries_match_id", "prediction_entries", ["match_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_prediction_entries_match_id", table_name="prediction_entries")
    op.drop_index("ix_prediction_entries_user_id", table_name="prediction_entries")
    op.drop_table("prediction_entries")

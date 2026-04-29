"""add live_events table for canonical realtime events

Revision ID: f0c1a2b3d4e5
Revises: a12d9f4c8b77
Create Date: 2026-04-12 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "f0c1a2b3d4e5"
down_revision: Union[str, Sequence[str], None] = "a12d9f4c8b77"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "live_events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("match_id", sa.String(length=100), nullable=False),
        sa.Column("event_id", sa.String(length=255), nullable=False),
        sa.Column("sport", sa.String(length=50), nullable=False),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("player_id", sa.String(length=100), nullable=False, server_default=""),
        sa.Column("team_id", sa.String(length=100), nullable=False, server_default=""),
        sa.Column("value", sa.Float(), nullable=False, server_default=sa.text("0")),
        sa.Column("meta", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("ts", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("match_id", "event_id", name="uq_live_events_match_event"),
    )

    op.create_index(op.f("ix_live_events_match_id"), "live_events", ["match_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_live_events_match_id"), table_name="live_events")
    op.drop_table("live_events")

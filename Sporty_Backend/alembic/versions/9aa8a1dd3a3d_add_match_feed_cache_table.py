"""add match_feed_cache table for durable prediction/ratings/lineups backstop

Revision ID: 9aa8a1dd3a3d
Revises: dd69edd8db7d
Create Date: 2026-07-04 19:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "9aa8a1dd3a3d"
down_revision: Union[str, Sequence[str], None] = "dd69edd8db7d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "match_feed_cache",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("match_id", sa.UUID(), nullable=False),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["match_id"], ["matches.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("match_id", "kind", name="uq_match_feed_cache_match_kind"),
    )
    op.create_index(op.f("ix_match_feed_cache_match_id"), "match_feed_cache", ["match_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_match_feed_cache_match_id"), table_name="match_feed_cache")
    op.drop_table("match_feed_cache")

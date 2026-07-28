"""per-match player scores (per-match scoring layer)

player_match_scores: one row per (player, match) holding the match's metric
snapshot + engine-computed fantasy_points/breakdown + bonus placeholders. The
window-level PlayerGameweekStat.fantasy_points is the SUM of these.

Revision ID: c4e6a8b0d2f3
Revises: b3d5f7a9c1e2
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "c4e6a8b0d2f3"
down_revision = "b3d5f7a9c1e2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "player_match_scores",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("player_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("match_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("transfer_window_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("position", sa.String(length=3), nullable=True),
        sa.Column("minutes", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column("stats", postgresql.JSONB(), nullable=True),
        sa.Column("fantasy_points", sa.Numeric(precision=8, scale=2), nullable=False, server_default="0"),
        sa.Column("bps", sa.Numeric(precision=8, scale=2), nullable=False, server_default="0"),
        sa.Column("bonus_points", sa.Numeric(precision=6, scale=2), nullable=False, server_default="0"),
        sa.Column("breakdown", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["player_id"], ["players.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["match_id"], ["matches.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["transfer_window_id"], ["transfer_windows.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("player_id", "match_id", "transfer_window_id", name="uq_player_match_score"),
    )
    op.create_index("ix_player_match_scores_player_id", "player_match_scores", ["player_id"])
    op.create_index("ix_player_match_scores_match_id", "player_match_scores", ["match_id"])
    op.create_index("ix_player_match_scores_transfer_window_id", "player_match_scores", ["transfer_window_id"])


def downgrade() -> None:
    op.drop_table("player_match_scores")

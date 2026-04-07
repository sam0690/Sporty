"""add player_price_history table

Revision ID: 9f2c7b7f11a4
Revises: 4d7296a4da76
Create Date: 2026-04-06 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9f2c7b7f11a4"
down_revision: Union[str, Sequence[str], None] = "4d7296a4da76"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "player_price_history",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("player_id", sa.UUID(), nullable=False),
        sa.Column("transfer_window_id", sa.UUID(), nullable=True),
        sa.Column("old_cost", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("new_cost", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("delta", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("weighted_points", sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column("algorithm_version", sa.String(length=30), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("old_cost >= 0", name="ck_price_history_old_cost_non_negative"),
        sa.CheckConstraint("new_cost >= 0", name="ck_price_history_new_cost_non_negative"),
        sa.ForeignKeyConstraint(["player_id"], ["players.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["transfer_window_id"],
            ["transfer_windows.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_player_price_history_player_id"),
        "player_price_history",
        ["player_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_player_price_history_transfer_window_id"),
        "player_price_history",
        ["transfer_window_id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_player_price_history_transfer_window_id"), table_name="player_price_history")
    op.drop_index(op.f("ix_player_price_history_player_id"), table_name="player_price_history")
    op.drop_table("player_price_history")

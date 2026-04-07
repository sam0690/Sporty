"""add budget transactions table

Revision ID: d4a7c2b1e8f0
Revises: c9e4f12a7b21
Create Date: 2026-04-08 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d4a7c2b1e8f0"
down_revision: Union[str, Sequence[str], None] = "c9e4f12a7b21"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "budget_transactions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("fantasy_team_id", sa.UUID(), nullable=False),
        sa.Column("player_id", sa.UUID(), nullable=True),
        sa.Column("transfer_window_id", sa.UUID(), nullable=True),
        sa.Column("transaction_type", sa.String(length=30), nullable=False),
        sa.Column("amount", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("penalty_applied", sa.Numeric(precision=10, scale=2), nullable=False, server_default=sa.text("0.00")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("amount >= 0", name="ck_budget_tx_amount_non_negative"),
        sa.CheckConstraint("penalty_applied >= 0", name="ck_budget_tx_penalty_non_negative"),
        sa.CheckConstraint(
            "transaction_type IN ('purchase', 'discard', 'transfer_out_refund', 'transfer_in_cost')",
            name="ck_budget_tx_type_allowed",
        ),
        sa.ForeignKeyConstraint(["fantasy_team_id"], ["fantasy_teams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["player_id"], ["players.id"]),
        sa.ForeignKeyConstraint(["transfer_window_id"], ["transfer_windows.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_index(op.f("ix_budget_transactions_fantasy_team_id"), "budget_transactions", ["fantasy_team_id"], unique=False)
    op.create_index(op.f("ix_budget_transactions_player_id"), "budget_transactions", ["player_id"], unique=False)
    op.create_index(op.f("ix_budget_transactions_transfer_window_id"), "budget_transactions", ["transfer_window_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_budget_transactions_transfer_window_id"), table_name="budget_transactions")
    op.drop_index(op.f("ix_budget_transactions_player_id"), table_name="budget_transactions")
    op.drop_index(op.f("ix_budget_transactions_fantasy_team_id"), table_name="budget_transactions")
    op.drop_table("budget_transactions")

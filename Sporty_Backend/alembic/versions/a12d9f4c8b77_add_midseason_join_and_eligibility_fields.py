"""add midseason join and eligibility fields

Revision ID: a12d9f4c8b77
Revises: e7a9b1c4d2f3
Create Date: 2026-04-09 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a12d9f4c8b77"
down_revision: Union[str, Sequence[str], None] = "e7a9b1c4d2f3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "leagues",
        sa.Column("allow_midseason_join", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "league_memberships",
        sa.Column("eligible_from_window_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        "fk_league_memberships_eligible_from_window_id_transfer_windows",
        "league_memberships",
        "transfer_windows",
        ["eligible_from_window_id"],
        ["id"],
    )
    op.create_index(
        "ix_league_memberships_eligible_from_window_id",
        "league_memberships",
        ["eligible_from_window_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_league_memberships_eligible_from_window_id", table_name="league_memberships")
    op.drop_constraint(
        "fk_league_memberships_eligible_from_window_id_transfer_windows",
        "league_memberships",
        type_="foreignkey",
    )
    op.drop_column("league_memberships", "eligible_from_window_id")
    op.drop_column("leagues", "allow_midseason_join")

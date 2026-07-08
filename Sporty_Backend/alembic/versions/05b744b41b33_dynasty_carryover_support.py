"""dynasty_carryover_support

Drops the fantasy_teams.current_budget >= 0 check constraint (a dynasty-
renewed team's carried roster can legitimately cost more than the new
season's budget_per_team if player prices drifted, and app-layer acquisition
checks already freeze such a team out of new purchases until it drops back
to >= 0) and widens roster_moves.move_type to allow 'dynasty_carryover'.

Revision ID: 05b744b41b33
Revises: 918c7baf710b
Create Date: 2026-07-08 11:08:00.572869

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = '05b744b41b33'
down_revision: Union[str, Sequence[str], None] = '918c7baf710b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_constraint(
        "ck_team_budget_non_negative", "fantasy_teams", type_="check"
    )
    op.drop_constraint("ck_roster_move_type", "roster_moves", type_="check")
    op.create_check_constraint(
        "ck_roster_move_type",
        "roster_moves",
        "move_type IN ('draft', 'free_agent', 'waiver', 'trade', 'dynasty_carryover')",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("ck_roster_move_type", "roster_moves", type_="check")
    op.create_check_constraint(
        "ck_roster_move_type",
        "roster_moves",
        "move_type IN ('draft', 'free_agent', 'waiver', 'trade')",
    )
    op.create_check_constraint(
        "ck_team_budget_non_negative", "fantasy_teams", "current_budget >= 0"
    )

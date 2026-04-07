"""add league start and end dates

Revision ID: c9e4f12a7b21
Revises: b1c2d3e4f5a6
Create Date: 2026-04-07 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c9e4f12a7b21"
down_revision: Union[str, Sequence[str], None] = "b1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("leagues", sa.Column("start_date", sa.Date(), nullable=True))
    op.add_column("leagues", sa.Column("end_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("leagues", "end_date")
    op.drop_column("leagues", "start_date")

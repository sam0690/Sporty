"""add league season lineage (season_group_id, season_number)

Revision ID: a1b2c3d4e5f6
Revises: 9f4a2b6e1d3c
Create Date: 2026-07-05 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '9f4a2b6e1d3c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ADD VALUE can't run in the same transaction as a statement that USES
    # the new value, but nothing here does, so this is safe inside alembic's
    # single-transaction migration.
    op.execute("ALTER TYPE adminactiontype_enum ADD VALUE IF NOT EXISTS 'season_create'")

    op.add_column(
        'leagues',
        sa.Column('season_group_id', UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        'leagues',
        sa.Column(
            'season_number', sa.SmallInteger(), nullable=False, server_default='1'
        ),
    )

    # Backfill: every existing league becomes the head of its own
    # single-league season lineage.
    op.execute('UPDATE leagues SET season_group_id = id WHERE season_group_id IS NULL')

    op.alter_column('leagues', 'season_group_id', nullable=False)
    op.alter_column('leagues', 'season_number', server_default=None)

    op.create_index(
        'ix_leagues_season_group_id', 'leagues', ['season_group_id']
    )


def downgrade() -> None:
    op.drop_index('ix_leagues_season_group_id', table_name='leagues')
    op.drop_column('leagues', 'season_number')
    op.drop_column('leagues', 'season_group_id')

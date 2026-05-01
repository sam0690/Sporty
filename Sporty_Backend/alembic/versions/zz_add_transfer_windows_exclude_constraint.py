"""add exclusion constraint to prevent overlapping transfer_windows per season

Revision ID: zz_add_transfer_windows_exclude_constraint
Revises: f37971ec400e
Create Date: 2026-05-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'zz_add_transfer_windows_exclude_constraint'
down_revision = 'f37971ec400e'
branch_labels = None
depends_on = None


def upgrade():
    # Ensure the btree_gist extension is available (Postgres)
    op.execute('CREATE EXTENSION IF NOT EXISTS btree_gist;')

    # Add exclusion constraint to prevent overlapping windows per season
    op.execute(
        """
        ALTER TABLE transfer_windows
        ADD CONSTRAINT transfer_windows_no_overlap
        EXCLUDE USING gist (
          season_id WITH =,
          tstzrange(start_at, end_at, '[]') WITH &&
        );
        """
    )


def downgrade():
    op.execute('ALTER TABLE transfer_windows DROP CONSTRAINT IF EXISTS transfer_windows_no_overlap;')
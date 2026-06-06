"""add btree_gist overlap exclusion constraints for seasons and transfer_windows

Revision ID: b2c3d4e5f6a7
Revises: 6f7e8d9c0b1a
Create Date: 2026-06-06 02:00:00.000000

Why:
  Season and TransferWindow previously relied only on service-layer checks to
  prevent overlapping date/time ranges.  These constraints push the guarantee
  into the database so concurrent inserts and direct SQL mutations cannot
  produce overlapping rows.

Constraints added:
  seasons.excl_season_sport_no_overlap
    — no two active seasons for the same sport may cover overlapping date ranges.
    Uses daterange(start_date, end_date, '[]') so both endpoints are inclusive,
    matching the Season.is_current property semantics.

  transfer_windows.excl_transfer_window_season_no_overlap
    — no two transfer windows within the same season may have overlapping time
    ranges.  Uses tstzrange(start_at, end_at, '[]') with timezone-aware columns.

Both constraints require the btree_gist extension, which enables GIST index
support for scalar equality operators (UUID WITH =) alongside range operators.
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, Sequence[str], None] = "6f7e8d9c0b1a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # btree_gist lets GIST indexes cover both scalar equality (UUID WITH =) and
    # range overlap (daterange / tstzrange WITH &&) in a single composite index.
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")

    # Prevent two seasons for the same sport from overlapping on their date range.
    # '[]' makes both endpoints inclusive — consistent with Season.is_current.
    op.execute(
        """
        ALTER TABLE seasons
            ADD CONSTRAINT excl_season_sport_no_overlap
            EXCLUDE USING gist (
                sport_id    WITH =,
                daterange(start_date, end_date, '[]') WITH &&
            )
        """
    )

    # Prevent two transfer windows within the same season from overlapping on
    # their timestamp range.  '[]' makes both endpoints inclusive.
    op.execute(
        """
        ALTER TABLE transfer_windows
            ADD CONSTRAINT excl_transfer_window_season_no_overlap
            EXCLUDE USING gist (
                season_id   WITH =,
                tstzrange(start_at, end_at, '[]') WITH &&
            )
        """
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE transfer_windows "
        "DROP CONSTRAINT IF EXISTS excl_transfer_window_season_no_overlap"
    )
    op.execute(
        "ALTER TABLE seasons "
        "DROP CONSTRAINT IF EXISTS excl_season_sport_no_overlap"
    )
    # Drop the extension last.  IF EXISTS makes this a no-op if already removed.
    # CASCADE is intentionally omitted: if anything else depends on btree_gist
    # the DROP will fail loudly rather than silently removing dependent objects.
    op.execute("DROP EXTENSION IF EXISTS btree_gist")

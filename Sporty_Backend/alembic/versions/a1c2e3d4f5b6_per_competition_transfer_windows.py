"""per-competition transfer windows + match matchday

Adds:
  - matches.matchday            (fdo gameweek number, 1..38/34; nullable)
  - transfer_windows.competition (EPL/LALIGA/BUNDESLIGA per-competition
                                   gameweek schedule; NULL = combined schedule
                                   for all-competitions leagues + other sports)

Re-partitions the transfer_windows uniqueness + no-overlap guards by
(season_id, COALESCE(competition, '')) so:
  - per-competition windows may overlap in real time (EPL GW5 vs LALIGA GW5),
  - the combined (NULL) schedule is one partition whose windows still can't
    overlap/collide each other.

Revision ID: a1c2e3d4f5b6
Revises: e4b9c1d7f320
"""
from alembic import op
import sqlalchemy as sa


revision = "a1c2e3d4f5b6"
down_revision = "e4b9c1d7f320"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("matches", sa.Column("matchday", sa.Integer(), nullable=True))
    op.add_column(
        "transfer_windows",
        sa.Column("competition", sa.String(length=20), nullable=True),
    )

    # Old (season_id, number) uniqueness → (season_id, COALESCE(competition,''), number).
    op.drop_constraint(
        "uq_transfer_window_season_number", "transfer_windows", type_="unique"
    )
    op.execute(
        """
        CREATE UNIQUE INDEX uq_transfer_window_season_comp_number
        ON transfer_windows (season_id, COALESCE(competition, ''), number)
        """
    )

    # Repartition the no-overlap exclusion to include competition. The live DB
    # carries TWO identical season-only overlap excludes — the model's
    # excl_transfer_window_season_no_overlap plus a legacy duplicate
    # transfer_windows_no_overlap (not declared in the model). Both forbid any
    # same-season overlap regardless of competition, so both must go.
    op.execute(
        "ALTER TABLE transfer_windows "
        "DROP CONSTRAINT IF EXISTS transfer_windows_no_overlap"
    )
    op.execute(
        "ALTER TABLE transfer_windows "
        "DROP CONSTRAINT IF EXISTS excl_transfer_window_season_no_overlap"
    )
    op.execute(
        """
        ALTER TABLE transfer_windows
            ADD CONSTRAINT excl_transfer_window_season_no_overlap
            EXCLUDE USING gist (
                season_id WITH =,
                (COALESCE(competition, '')) WITH =,
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
        """
        ALTER TABLE transfer_windows
            ADD CONSTRAINT excl_transfer_window_season_no_overlap
            EXCLUDE USING gist (
                season_id WITH =,
                tstzrange(start_at, end_at, '[]') WITH &&
            )
        """
    )
    # Restore the legacy duplicate exclude for a faithful downgrade.
    op.execute(
        """
        ALTER TABLE transfer_windows
            ADD CONSTRAINT transfer_windows_no_overlap
            EXCLUDE USING gist (
                season_id WITH =,
                tstzrange(start_at, end_at, '[]') WITH &&
            )
        """
    )
    op.execute("DROP INDEX IF EXISTS uq_transfer_window_season_comp_number")
    op.create_unique_constraint(
        "uq_transfer_window_season_number",
        "transfer_windows",
        ["season_id", "number"],
    )
    op.drop_column("transfer_windows", "competition")
    op.drop_column("matches", "matchday")

"""backfill league_sports.season_id for pre-mapping rows

Revision ID: a1c9e7d24f60
Revises: c3f8a1d6e029
Create Date: 2026-07-16 18:00:00.000000

Why:
  c3f8a1d6e029 added league_sports.season_id (the explicit cross-sport
  season mapping) but never backfilled rows that existed before it, so
  every pre-migration multisport league still has season_id=NULL and
  get_league_sport_season() resolves nothing for its secondary sports.
  Symptom: the scoring sweep logs "No equivalent <sport> window for
  league=..." every cycle and counts those leagues as skipped.

Rule (mirrors _current_season_for_sport in league_service, which new
leagues go through at creation):
  1. Sport == the league's own season's sport -> the league's own season.
  2. Otherwise -> the active season of that sport whose date range
     overlaps the league's own season's date range.
Rows with no matching season are left NULL (same "log loudly and skip"
behavior as today) rather than guessed.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1c9e7d24f60'
down_revision: Union[str, Sequence[str], None] = 'c3f8a1d6e029'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Backfill data only; no schema change."""
    # Case 1: the row's sport is the league's own sport.
    op.execute(
        """
        UPDATE league_sports ls
        SET season_id = l.season_id
        FROM leagues l
        JOIN seasons own ON own.id = l.season_id
        WHERE ls.league_id = l.id
          AND ls.season_id IS NULL
          AND ls.sport_id = own.sport_id
        """
    )
    # Case 2: secondary sports — active season of that sport overlapping
    # the league's own season. ORDER BY start_date DESC picks the most
    # recent season if several overlap (none do today).
    op.execute(
        """
        UPDATE league_sports ls
        SET season_id = (
            SELECT s.id
            FROM seasons s
            JOIN leagues l ON l.id = ls.league_id
            JOIN seasons own ON own.id = l.season_id
            WHERE s.sport_id = ls.sport_id
              AND s.is_active = TRUE
              AND s.start_date <= own.end_date
              AND s.end_date >= own.start_date
            ORDER BY s.start_date DESC
            LIMIT 1
        )
        WHERE ls.season_id IS NULL
        """
    )


def downgrade() -> None:
    """Data backfill — nothing to restore (rows were NULL before)."""
    pass

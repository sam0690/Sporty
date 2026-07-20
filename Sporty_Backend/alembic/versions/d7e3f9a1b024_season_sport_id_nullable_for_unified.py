"""make seasons.sport_id nullable for unified multisport seasons

Revision ID: d7e3f9a1b024
Revises: e2f6c8a94b13
Create Date: 2026-07-20 00:00:00.000000

Why (Phase 1 of docs/UNIFIED_MULTISPORT_SCHEDULE_PLAN.md — inert schema prep):
  A "unified" multisport season is a real Season row with sport_id IS NULL whose
  dates are the overlap window of its component sports' seasons. It lets a
  multisport league schedule lineups/transfers/scoring on its own independent
  gameweek numbering, reusing the entire existing TransferWindow machinery
  unchanged (generate_transfer_windows_for_season reads only start/end/transfer_day).

  This migration is deliberately INERT: it only relaxes a NOT NULL and adds one
  partial constraint scoped to sport_id IS NULL. No existing row is NULL, so no
  existing query, unique check, or the excl_season_sport_no_overlap GIST exclude
  changes behavior. Nothing reads the nullable column differently yet — the
  create_league / admin / scoring branches land in later phases.

Changes:
  seasons.sport_id  ->  DROP NOT NULL

  seasons.component_sport_ids  ->  ADD nullable JSONB
    — for unified seasons only: the sports this schedule composes, as a list of
      sport UUID strings. Display/admin only; never read by scoring. NULL for
      real-sport seasons.

  uq_unified_season_name (partial unique index)
    — UNIQUE (name) WHERE sport_id IS NULL. The existing uq_season_sport_name is
      (sport_id, name); NULL sport_id rows never collide under it (NULL != NULL),
      so unified seasons would otherwise allow duplicate names. This guards that.
      No date-overlap constraint is added for unified rows on purpose: two
      distinct unified seasons (different sport mixes) may overlap in time.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "d7e3f9a1b024"
down_revision: Union[str, Sequence[str], None] = "e2f6c8a94b13"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE seasons ALTER COLUMN sport_id DROP NOT NULL")
    op.add_column(
        "seasons",
        sa.Column("component_sport_ids", postgresql.JSONB(), nullable=True),
    )
    # Partial unique: dedupe unified-season names (sport_id-keyed uq can't).
    op.execute(
        "CREATE UNIQUE INDEX uq_unified_season_name "
        "ON seasons (name) WHERE sport_id IS NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_unified_season_name")
    op.drop_column("seasons", "component_sport_ids")
    # Re-adding NOT NULL fails loudly if any unified season already exists —
    # correct: you cannot revert this once unified seasons have been created.
    op.execute("ALTER TABLE seasons ALTER COLUMN sport_id SET NOT NULL")

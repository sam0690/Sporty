"""backfill real_team_id from real_team string and promote to NOT NULL

Revision ID: c4d5e6f7a8b9
Revises: b2c3d4e5f6a7
Create Date: 2026-06-06 03:00:00.000000

Why:
  Player.real_team_id was added as a nullable FK alongside the legacy
  Player.real_team string column.  The sync service now writes both, but
  historical rows and any player inserted without going through the sync
  still have real_team_id = NULL.

  This migration:
    1. Pre-flight: aborts if any player has no matching RealTeam row so
       the operator can fix data before re-running.
    2. Batched backfill: joins players.real_team + players.sport_id against
       real_teams.name + real_teams.sport_id — the same composite key used
       by the sync service — in 5 000-row chunks.
    3. Verification: counts remaining NULLs; aborts if any survive the loop.
    4. FK swap: drops the original SET NULL FK (incompatible with NOT NULL)
       and re-adds it with RESTRICT.
    5. NOT NULL: uses the NOT VALID → VALIDATE CONSTRAINT → SET NOT NULL
       pattern (PostgreSQL 12+) so the table rescan runs under
       SHARE UPDATE EXCLUSIVE rather than ACCESS EXCLUSIVE.

Batching note:
  All batches run inside Alembic's single migration transaction, which limits
  the overall lock to the transaction duration.  Each batch acquires at most
  5 000 row-level locks simultaneously, keeping per-batch lock pressure low.
  For tables larger than ~10 M rows consider running the backfill as a
  stand-alone script in autocommit mode BEFORE this migration, then
  re-running with the table already fully backfilled (the loop exits in one
  iteration with rowcount == 0, so the migration is idempotent).

Downgrade:
  Drops NOT NULL and restores the SET NULL FK.  Backfilled data is preserved
  (real_team_id stays populated for rows that were backfilled).
"""

from __future__ import annotations

from alembic import op
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = "c4d5e6f7a8b9"
down_revision: str = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None

_FK_NAME = "fk_players_real_team_id_real_teams"
_BATCH_SIZE = 5_000


def upgrade() -> None:
    conn = op.get_bind()

    # ── 0. Pre-flight: abort if any player has no matching RealTeam ─────────────
    #
    # A missing match means the real_teams table doesn't have a row for that
    # (sport_id, name) pair — the operator must insert the missing RealTeam rows
    # and re-run this migration.
    unmatched: int = conn.execute(text("""
        SELECT COUNT(*)
        FROM players p
        WHERE p.real_team_id IS NULL
          AND NOT EXISTS (
              SELECT 1
              FROM real_teams rt
              WHERE rt.name      = p.real_team
                AND rt.sport_id  = p.sport_id
          )
    """)).scalar() or 0

    if unmatched:
        sample = conn.execute(text("""
            SELECT DISTINCT p.real_team, sp.name AS sport_name
            FROM   players p
            JOIN   sports  sp ON sp.id = p.sport_id
            WHERE  p.real_team_id IS NULL
              AND  NOT EXISTS (
                  SELECT 1 FROM real_teams rt
                  WHERE rt.name = p.real_team AND rt.sport_id = p.sport_id
              )
            ORDER  BY sp.name, p.real_team
            LIMIT  20
        """)).fetchall()
        detail = "\n".join(
            f"  sport={r.sport_name!r}  real_team={r.real_team!r}" for r in sample
        )
        raise ValueError(
            f"{unmatched} player(s) cannot be backfilled — no matching RealTeam row "
            f"for (sport_id, real_team).\n"
            f"Insert the missing rows into real_teams and re-run this migration:\n"
            f"{detail}"
        )

    # ── 1. Batched backfill ──────────────────────────────────────────────────────
    #
    # UPDATE ... FROM real_teams WHERE ... AND players.id IN (SELECT id ... LIMIT n)
    #
    # The inner SELECT uses ix_players_real_team_id (on real_team_id IS NULL) to
    # page through only the unprocessed rows cheaply.  ORDER BY id gives a stable
    # cursor so repeated runs converge even if rows are inserted concurrently.
    total_updated = 0
    while True:
        result = conn.execute(text("""
            UPDATE players
            SET    real_team_id = rt.id
            FROM   real_teams rt
            WHERE  players.real_team   = rt.name
              AND  players.sport_id    = rt.sport_id
              AND  players.real_team_id IS NULL
              AND  players.id IN (
                       SELECT id
                       FROM   players
                       WHERE  real_team_id IS NULL
                       ORDER  BY id
                       LIMIT  :batch_size
                   )
        """), {"batch_size": _BATCH_SIZE})

        total_updated += result.rowcount
        if result.rowcount == 0:
            break

    # ── 2. Verify: zero NULLs must remain ────────────────────────────────────────
    null_count: int = conn.execute(
        text("SELECT COUNT(*) FROM players WHERE real_team_id IS NULL")
    ).scalar() or 0

    if null_count:
        raise ValueError(
            f"Backfill incomplete: {null_count} player(s) still have NULL real_team_id "
            f"after processing {total_updated} rows.  This should not happen if the "
            f"pre-flight check passed — investigate before re-running."
        )

    # ── 3. Swap FK: SET NULL → RESTRICT ──────────────────────────────────────────
    #
    # ON DELETE SET NULL is incompatible with a NOT NULL column: a RealTeam
    # deletion would attempt to NULL the column and immediately violate the
    # constraint, producing a confusing error.  RESTRICT makes the intent clear:
    # deleting a RealTeam that still has players is forbidden.
    op.drop_constraint(_FK_NAME, "players", type_="foreignkey")
    op.create_foreign_key(
        _FK_NAME,
        "players",
        "real_teams",
        ["real_team_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    # ── 4. Promote column to NOT NULL ────────────────────────────────────────────
    #
    # NOT VALID → VALIDATE CONSTRAINT → SET NOT NULL pattern (PostgreSQL 12+):
    #
    #   a. ADD CONSTRAINT ... NOT VALID   — instant; records constraint in catalog
    #                                       without scanning existing rows.
    #   b. VALIDATE CONSTRAINT            — scans table under SHARE UPDATE EXCLUSIVE
    #                                       (allows concurrent reads AND writes).
    #   c. ALTER COLUMN SET NOT NULL      — PostgreSQL 12+ detects the validated
    #                                       CHECK and skips the full-table rescan;
    #                                       the column flag flip is effectively instant.
    #   d. DROP CONSTRAINT                — remove the helper CHECK (redundant once
    #                                       the column carries its own NOT NULL).
    op.execute(
        "ALTER TABLE players "
        "ADD CONSTRAINT nn_players_real_team_id "
        "CHECK (real_team_id IS NOT NULL) NOT VALID"
    )
    op.execute("ALTER TABLE players VALIDATE CONSTRAINT nn_players_real_team_id")
    op.execute("ALTER TABLE players ALTER COLUMN real_team_id SET NOT NULL")
    op.execute("ALTER TABLE players DROP CONSTRAINT nn_players_real_team_id")


def downgrade() -> None:
    # Reverse the NOT NULL promotion.
    op.execute("ALTER TABLE players ALTER COLUMN real_team_id DROP NOT NULL")

    # Restore the original FK semantics.
    op.drop_constraint(_FK_NAME, "players", type_="foreignkey")
    op.create_foreign_key(
        _FK_NAME,
        "players",
        "real_teams",
        ["real_team_id"],
        ["id"],
        ondelete="SET NULL",
    )
    # Backfilled data is intentionally left in place — real_team_id remains
    # populated for rows that were backfilled before the downgrade.

"""dedupe duplicate player rows created by clashing external_api_id namespaces

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-07-02 00:00:00.000000

Why:
  The players table has no uniqueness guarantee, and different importers assign
  different external_api_id namespaces to the SAME real player:
    - roster syncs  -> "nba:<id>" / "football:<id>"  (real, varied prices)
    - data feeder   -> "feeder:player:<id>"          (floor prices ~4.8-5.2)
  Each importer dedupes only by external_api_id, so a player seeded under one
  namespace and re-synced under another produces two rows with different costs.
  A handful of real fantasy squads already reference the duplicate rows.

What this does (single transaction):
  1. Builds a dup -> canonical map, grouping by (sport_id, folded name,
     real_team) — the name+team identity the live sync already trusts, so two
     genuinely different players who share a name but play for different teams
     are NOT merged.
  2. Canonical pick order: prefer a non-"feeder:" row (real provider), then the
     row with the most gameweek stats, then the higher cost, then the lowest id.
  3. Repoints every FK that references players.id from the duplicate rows to the
     canonical row. For child tables with a UNIQUE constraint involving
     player_id, conflicting child rows are deleted first (the canonical already
     covers that key) and the rest are repointed.
  4. Deletes the now-orphaned duplicate player rows (CASCADE mops up any
     leftover gameweek stats / price history on the removed rows).
  5. Verifies no (sport_id, folded name, real_team) group has >1 row; aborts
     the transaction otherwise.

  Idempotent: a second run finds no duplicates and is a no-op.

  NOTE: this only cleans existing data. It does NOT add a unique constraint,
  because the importers must first learn to match by name+team fallback (not
  external_api_id alone) or the next cross-namespace import would fail. That
  constraint + importer change is a follow-up migration.

Downgrade:
  Not reversible — deleted duplicate rows cannot be reconstructed. Downgrade is
  a no-op.
"""

from __future__ import annotations

from alembic import op
from sqlalchemy import text

revision = "e6f7a8b9c0d1"
down_revision = "d5e6f7a8b9c0"
branch_labels = None
depends_on = None


# Normalised name: lowercase, trimmed, internal whitespace collapsed.
_NORM = r"lower(regexp_replace(btrim(p.name), '\s+', ' ', 'g'))"


def upgrade() -> None:
    bind = op.get_bind()

    # 1 + 2. dup -> keep map, grouped by (sport_id, folded name, real_team).
    bind.execute(text(f"""
        CREATE TEMP TABLE _player_dedup ON COMMIT DROP AS
        WITH ranked AS (
            SELECT
                p.id,
                first_value(p.id) OVER (
                    PARTITION BY p.sport_id, {_NORM}, coalesce(p.real_team, '')
                    ORDER BY
                        (p.external_api_id LIKE 'feeder:%')::int ASC,   -- real provider first
                        (SELECT count(*) FROM player_gameweek_stats s
                         WHERE s.player_id = p.id) DESC,                -- most stats
                        p.cost DESC,                                    -- richest price
                        p.id ASC                                        -- deterministic
                ) AS keep_id
            FROM players p
        )
        SELECT id AS dup_id, keep_id
        FROM ranked
        WHERE id <> keep_id
    """))

    dup_count = bind.execute(text("SELECT count(*) FROM _player_dedup")).scalar()
    if not dup_count:
        return  # nothing to do

    # 3. Repoint FKs. Child tables with a UNIQUE constraint that includes
    #    player_id: delete rows that would collide with the canonical, then
    #    repoint the remainder.

    # team_players — UNIQUE (fantasy_team_id, player_id, acquired_window_id)
    #             and partial UNIQUE (fantasy_team_id, player_id) WHERE active.
    bind.execute(text("""
        DELETE FROM team_players d
        USING _player_dedup m
        WHERE d.player_id = m.dup_id
          AND EXISTS (
              SELECT 1 FROM team_players k
              WHERE k.player_id = m.keep_id
                AND k.fantasy_team_id = d.fantasy_team_id
                AND (
                    k.acquired_window_id IS NOT DISTINCT FROM d.acquired_window_id
                    OR (k.released_window_id IS NULL AND d.released_window_id IS NULL)
                )
          )
    """))
    bind.execute(text("""
        UPDATE team_players d SET player_id = m.keep_id
        FROM _player_dedup m WHERE d.player_id = m.dup_id
    """))

    # draft_picks — UNIQUE (league_id, player_id).
    bind.execute(text("""
        DELETE FROM draft_picks d
        USING _player_dedup m
        WHERE d.player_id = m.dup_id
          AND EXISTS (
              SELECT 1 FROM draft_picks k
              WHERE k.player_id = m.keep_id AND k.league_id = d.league_id
          )
    """))
    bind.execute(text("""
        UPDATE draft_picks d SET player_id = m.keep_id
        FROM _player_dedup m WHERE d.player_id = m.dup_id
    """))

    # player_gameweek_stats — UNIQUE (player_id, transfer_window_id).
    bind.execute(text("""
        DELETE FROM player_gameweek_stats d
        USING _player_dedup m
        WHERE d.player_id = m.dup_id
          AND EXISTS (
              SELECT 1 FROM player_gameweek_stats k
              WHERE k.player_id = m.keep_id
                AND k.transfer_window_id = d.transfer_window_id
          )
    """))
    bind.execute(text("""
        UPDATE player_gameweek_stats d SET player_id = m.keep_id
        FROM _player_dedup m WHERE d.player_id = m.dup_id
    """))

    # team_gameweek_lineups — UNIQUE (fantasy_team_id, transfer_window_id, player_id).
    bind.execute(text("""
        DELETE FROM team_gameweek_lineups d
        USING _player_dedup m
        WHERE d.player_id = m.dup_id
          AND EXISTS (
              SELECT 1 FROM team_gameweek_lineups k
              WHERE k.player_id = m.keep_id
                AND k.fantasy_team_id = d.fantasy_team_id
                AND k.transfer_window_id = d.transfer_window_id
          )
    """))
    bind.execute(text("""
        UPDATE team_gameweek_lineups d SET player_id = m.keep_id
        FROM _player_dedup m WHERE d.player_id = m.dup_id
    """))

    # No unique constraint on these — straight repoint.
    bind.execute(text("""
        UPDATE player_price_history d SET player_id = m.keep_id
        FROM _player_dedup m WHERE d.player_id = m.dup_id
    """))
    bind.execute(text("""
        UPDATE budget_transactions d SET player_id = m.keep_id
        FROM _player_dedup m WHERE d.player_id = m.dup_id
    """))
    bind.execute(text("""
        UPDATE transfers d SET player_in_id = m.keep_id
        FROM _player_dedup m WHERE d.player_in_id = m.dup_id
    """))
    bind.execute(text("""
        UPDATE transfers d SET player_out_id = m.keep_id
        FROM _player_dedup m WHERE d.player_out_id = m.dup_id
    """))

    # 4. Remove the duplicate player rows (CASCADE handles any leftover
    #    gameweek stats / price history).
    bind.execute(text("""
        DELETE FROM players p USING _player_dedup m WHERE p.id = m.dup_id
    """))

    # 5. Verify no duplicate identity groups remain.
    remaining = bind.execute(text(f"""
        SELECT count(*) FROM (
            SELECT 1 FROM players p
            GROUP BY p.sport_id, {_NORM}, coalesce(p.real_team, '')
            HAVING count(*) > 1
        ) g
    """)).scalar()
    if remaining:
        raise RuntimeError(
            f"player dedupe left {remaining} duplicate identity group(s); "
            "aborting so the transaction rolls back"
        )


def downgrade() -> None:
    # Deleted duplicate rows cannot be reconstructed.
    pass

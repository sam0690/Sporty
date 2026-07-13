"""merge Liverpool duplicate players and add the player-identity unique index

Revision ID: b7e4d2a91c58
Revises: 097ab8958b91
Create Date: 2026-07-13 00:00:00.000000

Why:
  The two EPL stat CSVs spell the club differently ("Liverpool" in the
  gameday-31 file, "Liverpool FC" in the gameday-35 file). The dataset
  importer builds player external_api_ids from the raw CSV team name, so the
  second import (2026-06-28 16:38, 18 minutes after the first) re-created the
  entire Liverpool roster under a "liverpool_fc" slug namespace — 20 exact
  name pairs plus two spelling-drift pairs (Andrew/Andy Robertson,
  Milo/Miloš Kerkez). Liverpool is the only club affected (the only team with
  two slugs out of 21).

  The earlier dedupe migration (e6f7a8b9c0d1, 2026-07-02) grouped by the
  real_team STRING, which still differed at the time ("Liverpool" vs
  "Liverpool FC"), so these pairs fell into different groups and survived.
  Later backfills normalised both sets onto one real_teams row, which is why
  they now render as identical twins in the UI.

What this does (single transaction):
  0. Renames the two spelling-drift rows to their canonical form so the
     generic grouping catches them.
  1-4. Same merge machinery as e6f7a8b9c0d1, but grouped by
     (sport_id, folded name, real_team_id) — the FK, not the string — and
     extended to the FK tables added since then (roster_moves, waiver_claims,
     user_favourite_players).
  5. Fixes the surviving Jeremie Frimpong row to DEF (his two copies
     disagreed: MID in one CSV, DEF in the other; DEF is correct and is the
     copy real squads reference).
  6. Verifies no duplicate identity remains, then creates the UNIQUE index
     the old migration deferred — importers now fall back to name+team
     matching (DatasetImporter._upsert_player, feed.py register_players), so
     a future namespace fork becomes an update instead of a duplicate, and
     anything that slips past both becomes an insert error instead of silent
     data corruption.

  Idempotent: a second run finds no duplicates; the index create is guarded
  with IF NOT EXISTS.

Downgrade: drops the index. Deleted duplicate rows cannot be reconstructed.
"""

from __future__ import annotations

from alembic import op
from sqlalchemy import text

revision = "b7e4d2a91c58"
down_revision = "097ab8958b91"
branch_labels = None
depends_on = None


# Normalised name: lowercase, trimmed, internal whitespace collapsed.
# Must stay in lockstep with the uq_players_identity index expression below.
_NORM = r"lower(regexp_replace(btrim(p.name), '\s+', ' ', 'g'))"

INDEX_NAME = "uq_players_identity"


def upgrade() -> None:
    bind = op.get_bind()

    # 0. Spelling-drift aliases: rename the duplicate to the survivor's
    #    spelling so the generic (name, team) grouping merges the pair. Both
    #    canonical spellings are the rows with the most gameweek stats, so the
    #    keep-picker below retains them and the name ends up correct.
    #    Scoped by external_api_id, not name: the gameday-31 Kerkez row is
    #    mojibake ("Milo Kerkez" — the Windows-1252 š byte decoded as a
    #    C1 control char), so a literal name match can never hit it.
    bind.execute(text("""
        UPDATE players SET name = 'Andy Robertson'
        WHERE external_api_id = 'football:andrew_robertson:liverpool:def'
    """))
    bind.execute(text("""
        UPDATE players SET name = 'Miloš Kerkez'
        WHERE external_api_id = 'football:milo_kerkez:liverpool:def'
    """))

    # 1 + 2. dup -> keep map, grouped by (sport_id, folded name, real_team_id).
    bind.execute(text("DROP TABLE IF EXISTS _player_dedup"))
    bind.execute(text(f"""
        CREATE TEMP TABLE _player_dedup ON COMMIT DROP AS
        WITH ranked AS (
            SELECT
                p.id,
                first_value(p.id) OVER (
                    PARTITION BY p.sport_id, {_NORM},
                                 coalesce(p.real_team_id::text, '')
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

    if dup_count:
        # 3. Repoint FKs. Child tables with a UNIQUE constraint that includes
        #    player_id: delete rows that would collide with the canonical,
        #    then repoint the remainder.

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

        # No unique constraint involving player id on these — straight repoint.
        # (user_favourite_players is UNIQUE (user_id, sport_id) only.)
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
        bind.execute(text("""
            UPDATE roster_moves d SET add_player_id = m.keep_id
            FROM _player_dedup m WHERE d.add_player_id = m.dup_id
        """))
        bind.execute(text("""
            UPDATE roster_moves d SET drop_player_id = m.keep_id
            FROM _player_dedup m WHERE d.drop_player_id = m.dup_id
        """))
        bind.execute(text("""
            UPDATE waiver_claims d SET add_player_id = m.keep_id
            FROM _player_dedup m WHERE d.add_player_id = m.dup_id
        """))
        bind.execute(text("""
            UPDATE waiver_claims d SET drop_player_id = m.keep_id
            FROM _player_dedup m WHERE d.drop_player_id = m.dup_id
        """))
        bind.execute(text("""
            UPDATE user_favourite_players d SET player_id = m.keep_id
            FROM _player_dedup m WHERE d.player_id = m.dup_id
        """))

        # 4. Remove the duplicate player rows (CASCADE handles any leftover
        #    child rows on the removed ids).
        bind.execute(text("""
            DELETE FROM players p USING _player_dedup m WHERE p.id = m.dup_id
        """))

    # 5. The merged Frimpong keeps whichever position his surviving row had
    #    (his two copies disagreed: MID vs DEF). He is a defender, and the
    #    copy real squads drafted was the DEF one — make it explicit.
    bind.execute(text("""
        UPDATE players SET position = 'DEF'
        WHERE name = 'Jeremie Frimpong' AND real_team = 'Liverpool'
    """))

    # 6. Verify, then enforce. The index expression must match _NORM above.
    remaining = bind.execute(text(f"""
        SELECT count(*) FROM (
            SELECT 1 FROM players p
            GROUP BY p.sport_id, {_NORM}, coalesce(p.real_team_id::text, '')
            HAVING count(*) > 1
        ) g
    """)).scalar()
    if remaining:
        raise RuntimeError(
            f"player dedupe left {remaining} duplicate identity group(s); "
            "aborting so the transaction rolls back"
        )

    bind.execute(text(f"""
        CREATE UNIQUE INDEX IF NOT EXISTS {INDEX_NAME}
        ON players (
            sport_id,
            lower(regexp_replace(btrim(name), '\\s+', ' ', 'g')),
            real_team_id
        )
    """))


def downgrade() -> None:
    op.execute(text(f"DROP INDEX IF EXISTS {INDEX_NAME}"))
    # Deleted duplicate rows cannot be reconstructed.

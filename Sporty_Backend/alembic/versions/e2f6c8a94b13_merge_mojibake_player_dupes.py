"""merge encoding-drift duplicate players (mojibake / '?'-substitution / ö-ø drift)

Revision ID: e2f6c8a94b13
Revises: a1c9e7d24f60
Create Date: 2026-07-18 00:00:00.000000

Why:
  b7e4d2a91c58 deduped players by (sport_id, folded name, real_team_id) and
  added the uq_players_identity index — but pairs whose NAMES differ as
  strings fold to different identities and survived. Verified 2026-07-18:
  ten pairs remain, all the same player twice on the same real team, split
  by how the two stat CSVs mangled diacritics:

    - Windows-1252 mojibake — Š/š bytes decoded as C1 control chars:
      Benjamin Šeško (MUN), Joško Gvardiol (MCI), Saša Lukić (FUL),
      Tomáš Souček (WHU)
    - '?'-substituted decode failures — č/ć/ı/ğ/Đ became literal '?':
      Altay Bayındır (MUN), Ferdi Kadıoğlu (BHA), Mateo Kovačić (MCI),
      Nikola Milenković (NFO), Đorđe Petrović (BOU)
    - spelling drift: David Möller/Møller Wolfe (WOL)

  No pair has colliding gameweek-stat windows (each row holds different
  GWs), so the merge combines their stat history losslessly.

What this does (single transaction):
  1. Groups players by (sport_id, ASCII-skeleton name, real_team_id), where
     the skeleton strips non-ASCII and '?' chars — every mangling above
     collapses to the same skeleton. Keep-picker is the same tiebreak as
     b7e4d2a91c58 (feeder rows, then most stats, richest cost, id). Each
     group also records its canonical name: the least-garbled member's
     name (no control chars / '?'), stats-richer first on ties.
  2-3. Repoints every player FK with the same machinery as b7e4d2a91c58
     (collision-guarded deletes on uniquely-constrained child tables, then
     straight repoints), and deletes the duplicate rows.
  4. Renames the survivors to their group's canonical name, plus an
     explicit fix for the Wolfe pair (both spellings are un-garbled, so
     cleanliness can't rank them; Møller is correct). Runs AFTER the
     delete so renames cannot trip uq_players_identity.
  5. Verifies no same-team skeleton duplicate remains, aborting (and
     rolling back) if one does.

  Idempotent: a second run finds no duplicate groups and the renames are
  no-ops.

Downgrade: no-op. Deleted duplicate rows cannot be reconstructed.
"""

from __future__ import annotations

from alembic import op
from sqlalchemy import text

revision = "e2f6c8a94b13"
down_revision = "a1c9e7d24f60"
branch_labels = None
depends_on = None


# ASCII skeleton: strip non-printable-ASCII and '?', trim, collapse
# whitespace, lowercase. All observed manglings of one real name (C1
# mojibake, '?' substitution, ö/ø drift) collapse to the same skeleton.
_SKEL = (
    r"lower(regexp_replace(btrim("
    r"regexp_replace(p.name, '[^\x20-\x7E]|\?', '', 'g')"
    r"), '\s+', ' ', 'g'))"
)

# A garbled name contains a C0/C1 control char or a '?'.
_GARBLED = r"'[\x01-\x1F\x7F-\x9F?]'"


def upgrade() -> None:
    bind = op.get_bind()

    # 1. dup -> keep map + canonical group name.
    bind.execute(text("DROP TABLE IF EXISTS _player_dedup"))
    bind.execute(text(f"""
        CREATE TEMP TABLE _player_dedup ON COMMIT DROP AS
        WITH ranked AS (
            SELECT
                p.id,
                first_value(p.id) OVER (
                    PARTITION BY p.sport_id, {_SKEL},
                                 coalesce(p.real_team_id::text, '')
                    ORDER BY
                        (p.external_api_id LIKE 'feeder:%')::int ASC,   -- real provider first
                        (SELECT count(*) FROM player_gameweek_stats s
                         WHERE s.player_id = p.id) DESC,                -- most stats
                        p.cost DESC,                                    -- richest price
                        p.id ASC                                        -- deterministic
                ) AS keep_id,
                first_value(p.name) OVER (
                    PARTITION BY p.sport_id, {_SKEL},
                                 coalesce(p.real_team_id::text, '')
                    ORDER BY
                        (p.name ~ {_GARBLED})::int ASC,                 -- clean names first
                        (SELECT count(*) FROM player_gameweek_stats s
                         WHERE s.player_id = p.id) DESC,
                        p.id ASC
                ) AS canon_name
            FROM players p
        )
        SELECT id AS dup_id, keep_id, canon_name
        FROM ranked
        WHERE id <> keep_id
    """))

    dup_count = bind.execute(text("SELECT count(*) FROM _player_dedup")).scalar()

    if dup_count:
        # 2. Repoint FKs — same machinery as b7e4d2a91c58. Child tables with
        #    a UNIQUE constraint that includes player_id: delete rows that
        #    would collide with the canonical, then repoint the remainder.

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

        # 3. Remove the duplicate player rows.
        bind.execute(text("""
            DELETE FROM players p USING _player_dedup m WHERE p.id = m.dup_id
        """))

        # 4. Canonical spelling for the survivors (after the delete, so the
        #    rename cannot collide with uq_players_identity — the only row
        #    that folded to the target identity was the dup just removed).
        bind.execute(text("""
            UPDATE players p SET name = m.canon_name
            FROM (SELECT DISTINCT keep_id, canon_name FROM _player_dedup) m
            WHERE p.id = m.keep_id AND p.name <> m.canon_name
        """))

    # 4b. Wolfe: both spellings are un-garbled so the cleanliness ranking
    #     can't pick between them — Møller (Norwegian) is correct.
    bind.execute(text("""
        UPDATE players SET name = 'David Møller Wolfe'
        WHERE external_api_id IN (
            'football:david_mller_wolfe:wolverhampton:def',
            'football:david_moller_wolfe:wolverhampton:def'
        ) AND name <> 'David Møller Wolfe'
    """))

    # 5. Verify: no same-team pair may share an ASCII skeleton.
    remaining = bind.execute(text(f"""
        SELECT count(*) FROM players a
        JOIN players b
          ON a.id < b.id
         AND a.sport_id = b.sport_id
         AND a.real_team_id IS NOT DISTINCT FROM b.real_team_id
         AND (SELECT {_SKEL.replace('p.name', 'a.name')})
             = (SELECT {_SKEL.replace('p.name', 'b.name')})
    """)).scalar()
    if remaining:
        raise RuntimeError(
            f"mojibake dedupe left {remaining} duplicate pair(s); "
            "aborting so the transaction rolls back"
        )


def downgrade() -> None:
    # Deleted duplicate rows cannot be reconstructed.
    pass

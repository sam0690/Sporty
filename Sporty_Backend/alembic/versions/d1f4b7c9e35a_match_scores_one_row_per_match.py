"""player_match_scores: one row per (player, match), not per window

A match used to book its stats into EVERY covering transfer window — its own
competition's schedule AND the combined one — so every fact was stored twice
(154 rows for 77 real (player, match) pairs in production). Windows are ranges
over matches now, not storage keys: player_gameweek_stats is recomputed from
these rows per schedule (see window_locator.matches_in_window).

Also relaxes ck_stat_minutes_max: player_gameweek_stats.minutes_played is a
window rollup, so a double gameweek legitimately exceeds one match's 120.

Revision ID: d1f4b7c9e35a
Revises: 488add2426b5
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "d1f4b7c9e35a"
down_revision = "488add2426b5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Duplicates are byte-identical apart from transfer_window_id (the same
    # match booked once per covering schedule), so keeping an arbitrary one
    # loses nothing.
    op.execute(
        """
        DELETE FROM player_match_scores a
         USING player_match_scores b
         WHERE a.player_id = b.player_id
           AND a.match_id = b.match_id
           AND a.ctid > b.ctid
        """
    )
    op.drop_constraint("uq_player_match_score", "player_match_scores", type_="unique")
    op.drop_index("ix_player_match_scores_transfer_window_id", table_name="player_match_scores")
    op.drop_column("player_match_scores", "transfer_window_id")
    op.create_unique_constraint(
        "uq_player_match_score", "player_match_scores", ["player_id", "match_id"]
    )

    # player_gameweek_stats / football_stats are window rollups now, so the
    # per-match ceilings (120 minutes, 2 yellows, 1 red) no longer bound them —
    # a double gameweek sums two matches. 3x leaves the guard against garbage.
    op.drop_constraint("ck_stat_minutes_max", "player_gameweek_stats", type_="check")
    op.create_check_constraint(
        "ck_stat_minutes_max", "player_gameweek_stats", "minutes_played <= 300"
    )
    op.drop_constraint("ck_fb_yellow_cards_max", "football_stats", type_="check")
    op.create_check_constraint("ck_fb_yellow_cards_max", "football_stats", "yellow_cards <= 6")
    op.drop_constraint("ck_fb_red_cards_max", "football_stats", type_="check")
    op.create_check_constraint("ck_fb_red_cards_max", "football_stats", "red_cards <= 3")


def downgrade() -> None:
    # One-way for data: the deleted per-window duplicates cannot be restored,
    # and the re-added column has no value to backfill — hence nullable. Rerun
    # the scoring sweep after a downgrade if the old shape is actually needed.
    op.drop_constraint("ck_fb_red_cards_max", "football_stats", type_="check")
    op.create_check_constraint("ck_fb_red_cards_max", "football_stats", "red_cards <= 1")
    op.drop_constraint("ck_fb_yellow_cards_max", "football_stats", type_="check")
    op.create_check_constraint("ck_fb_yellow_cards_max", "football_stats", "yellow_cards <= 2")
    op.drop_constraint("ck_stat_minutes_max", "player_gameweek_stats", type_="check")
    op.create_check_constraint(
        "ck_stat_minutes_max", "player_gameweek_stats", "minutes_played <= 120"
    )

    op.drop_constraint("uq_player_match_score", "player_match_scores", type_="unique")
    op.add_column(
        "player_match_scores",
        sa.Column("transfer_window_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index(
        "ix_player_match_scores_transfer_window_id",
        "player_match_scores",
        ["transfer_window_id"],
    )
    op.create_unique_constraint(
        "uq_player_match_score",
        "player_match_scores",
        ["player_id", "match_id", "transfer_window_id"],
    )

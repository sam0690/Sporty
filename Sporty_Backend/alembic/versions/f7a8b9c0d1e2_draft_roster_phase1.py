"""draft roster mgmt phase 1: team_players league_id/is_draft + ownership index + roster_moves

Revision ID: f7a8b9c0d1e2
Revises: e6f7a8b9c0d1
Create Date: 2026-07-02 01:00:00.000000

Phase 1 of the draft roster-management feature (see
docs/DRAFT_ROSTER_MANAGEMENT.md):

  1. Denormalise league_id onto team_players (backfilled from fantasy_teams)
     and snapshot is_draft (from league.draft_mode) so the free-agent pool query
     and the ownership index avoid a fantasy_teams/leagues join.
  2. Partial unique index enforcing league-wide unique ownership for DRAFT
     leagues only (budget/classic leagues intentionally allow shared ownership).
  3. roster_moves audit table for draft/free-agent/waiver/trade moves.

Downgrade drops the index, columns, and table.
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "f7a8b9c0d1e2"
down_revision = "e6f7a8b9c0d1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1a. league_id: add nullable, backfill from fantasy_teams, then NOT NULL.
    op.add_column(
        "team_players",
        sa.Column("league_id", sa.UUID(), nullable=True),
    )
    op.execute("""
        UPDATE team_players tp
        SET league_id = ft.league_id
        FROM fantasy_teams ft
        WHERE ft.id = tp.fantasy_team_id
    """)
    op.alter_column("team_players", "league_id", nullable=False)
    op.create_foreign_key(
        "fk_team_players_league_id", "team_players", "leagues",
        ["league_id"], ["id"], ondelete="CASCADE",
    )
    op.create_index(
        "ix_team_players_league_id", "team_players", ["league_id"],
    )

    # 1b. is_draft: add NOT NULL default false, then set true for draft leagues.
    op.add_column(
        "team_players",
        sa.Column(
            "is_draft", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
    )
    op.execute("""
        UPDATE team_players tp
        SET is_draft = l.draft_mode
        FROM leagues l
        WHERE l.id = tp.league_id
    """)
    # Model has no server_default; drop it now that existing rows are populated.
    op.alter_column("team_players", "is_draft", server_default=None)

    # 2. League-wide unique ownership for draft leagues only.
    op.create_index(
        "uq_draft_active_player_ownership",
        "team_players",
        ["league_id", "player_id"],
        unique=True,
        postgresql_where=sa.text("released_window_id IS NULL AND is_draft = true"),
    )

    # 3. roster_moves audit table.
    op.create_table(
        "roster_moves",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("league_id", sa.UUID(), nullable=False),
        sa.Column("fantasy_team_id", sa.UUID(), nullable=False),
        sa.Column("move_type", sa.String(length=20), nullable=False),
        sa.Column("add_player_id", sa.UUID(), nullable=True),
        sa.Column("drop_player_id", sa.UUID(), nullable=True),
        sa.Column("window_id", sa.UUID(), nullable=True),
        sa.Column("actor_user_id", sa.UUID(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.func.now(), nullable=False,
        ),
        sa.ForeignKeyConstraint(["league_id"], ["leagues.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["fantasy_team_id"], ["fantasy_teams.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["add_player_id"], ["players.id"]),
        sa.ForeignKeyConstraint(["drop_player_id"], ["players.id"]),
        sa.ForeignKeyConstraint(["window_id"], ["transfer_windows.id"]),
        sa.ForeignKeyConstraint(
            ["actor_user_id"], ["users.id"], ondelete="SET NULL"
        ),
        sa.CheckConstraint(
            "move_type IN ('draft', 'free_agent', 'waiver', 'trade')",
            name="ck_roster_move_type",
        ),
    )
    op.create_index("ix_roster_moves_league_id", "roster_moves", ["league_id"])
    op.create_index(
        "ix_roster_moves_fantasy_team_id", "roster_moves", ["fantasy_team_id"]
    )
    op.create_index("ix_roster_moves_created_at", "roster_moves", ["created_at"])


def downgrade() -> None:
    op.drop_table("roster_moves")
    op.drop_index("uq_draft_active_player_ownership", table_name="team_players")
    op.drop_index("ix_team_players_league_id", table_name="team_players")
    op.drop_constraint(
        "fk_team_players_league_id", "team_players", type_="foreignkey"
    )
    op.drop_column("team_players", "is_draft")
    op.drop_column("team_players", "league_id")

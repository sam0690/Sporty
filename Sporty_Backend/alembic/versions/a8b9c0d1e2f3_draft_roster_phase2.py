"""draft roster mgmt phase 2: waiver_order, waiver_claims, trade_offers

Revision ID: a8b9c0d1e2f3
Revises: f7a8b9c0d1e2
Create Date: 2026-07-02 02:00:00.000000

Phase 2 tables for waivers + trades (see docs/DRAFT_ROSTER_MANAGEMENT.md).
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "a8b9c0d1e2f3"
down_revision = "f7a8b9c0d1e2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "waiver_order",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("league_id", sa.UUID(), nullable=False),
        sa.Column("fantasy_team_id", sa.UUID(), nullable=False),
        sa.Column("position", sa.SmallInteger(), nullable=False),
        sa.ForeignKeyConstraint(["league_id"], ["leagues.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["fantasy_team_id"], ["fantasy_teams.id"], ondelete="CASCADE"
        ),
        sa.UniqueConstraint("league_id", "fantasy_team_id", name="uq_waiver_order_team"),
        sa.UniqueConstraint("league_id", "position", name="uq_waiver_order_position"),
    )
    op.create_index("ix_waiver_order_league_id", "waiver_order", ["league_id"])
    op.create_index(
        "ix_waiver_order_fantasy_team_id", "waiver_order", ["fantasy_team_id"]
    )

    op.create_table(
        "waiver_claims",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("league_id", sa.UUID(), nullable=False),
        sa.Column("fantasy_team_id", sa.UUID(), nullable=False),
        sa.Column("add_player_id", sa.UUID(), nullable=False),
        sa.Column("drop_player_id", sa.UUID(), nullable=False),
        sa.Column("process_window_id", sa.UUID(), nullable=False),
        sa.Column("claim_priority", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column("priority_snapshot", sa.SmallInteger(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("failure_reason", sa.String(length=200), nullable=True),
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
        sa.ForeignKeyConstraint(["process_window_id"], ["transfer_windows.id"]),
        sa.CheckConstraint(
            "status IN ('pending', 'success', 'failed', 'cancelled')",
            name="ck_waiver_claim_status",
        ),
    )
    op.create_index("ix_waiver_claims_league_id", "waiver_claims", ["league_id"])
    op.create_index(
        "ix_waiver_claims_fantasy_team_id", "waiver_claims", ["fantasy_team_id"]
    )

    op.create_table(
        "trade_offers",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("league_id", sa.UUID(), nullable=False),
        sa.Column("from_team_id", sa.UUID(), nullable=False),
        sa.Column("to_team_id", sa.UUID(), nullable=False),
        sa.Column("offered_player_ids", sa.JSON(), nullable=False),
        sa.Column("requested_player_ids", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="proposed"),
        sa.Column("veto_deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True),
            server_default=sa.func.now(), nullable=False,
        ),
        sa.ForeignKeyConstraint(["league_id"], ["leagues.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["from_team_id"], ["fantasy_teams.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["to_team_id"], ["fantasy_teams.id"], ondelete="CASCADE"
        ),
        sa.CheckConstraint(
            "status IN ('proposed', 'accepted', 'rejected', 'cancelled', "
            "'vetoed', 'executed')",
            name="ck_trade_offer_status",
        ),
    )
    op.create_index("ix_trade_offers_league_id", "trade_offers", ["league_id"])
    op.create_index("ix_trade_offers_from_team_id", "trade_offers", ["from_team_id"])
    op.create_index("ix_trade_offers_to_team_id", "trade_offers", ["to_team_id"])


def downgrade() -> None:
    op.drop_table("trade_offers")
    op.drop_table("waiver_claims")
    op.drop_table("waiver_order")

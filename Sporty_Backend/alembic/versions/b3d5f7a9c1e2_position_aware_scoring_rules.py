"""position-aware, config-driven scoring rules + points breakdown

Extends default_scoring_rules so the scoring FORMULA is data, not code:
  - position (GKP/DEF/MID/FWD; NULL = all)  → position weighting
  - mode (per_unit/per_n/threshold/flat)     → how points apply to a count
  - param                                     → the N / threshold for those modes
Uniqueness moves to (sport_id, action, COALESCE(position,'')).

Adds player_gameweek_stats.breakdown (JSONB) — the explainable per-window
points breakdown the new engine writes alongside fantasy_points.

Revision ID: b3d5f7a9c1e2
Revises: a1c2e3d4f5b6
"""
from alembic import op
import sqlalchemy as sa


revision = "b3d5f7a9c1e2"
down_revision = "a1c2e3d4f5b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("default_scoring_rules", sa.Column("position", sa.String(length=3), nullable=True))
    op.add_column(
        "default_scoring_rules",
        sa.Column("mode", sa.String(length=12), nullable=False, server_default="per_unit"),
    )
    op.add_column(
        "default_scoring_rules",
        sa.Column("param", sa.Numeric(precision=6, scale=2), nullable=True),
    )
    # Repartition uniqueness by (action, position). COALESCE so NULL is one slot.
    op.drop_constraint("uq_default_rule_sport_action", "default_scoring_rules", type_="unique")
    op.execute(
        "CREATE UNIQUE INDEX uq_default_rule_sport_action_pos "
        "ON default_scoring_rules (sport_id, action, COALESCE(position, ''))"
    )

    op.add_column("player_gameweek_stats", sa.Column("breakdown", sa.dialects.postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("player_gameweek_stats", "breakdown")
    op.execute("DROP INDEX IF EXISTS uq_default_rule_sport_action_pos")
    op.create_unique_constraint(
        "uq_default_rule_sport_action", "default_scoring_rules", ["sport_id", "action"]
    )
    op.drop_column("default_scoring_rules", "param")
    op.drop_column("default_scoring_rules", "mode")
    op.drop_column("default_scoring_rules", "position")

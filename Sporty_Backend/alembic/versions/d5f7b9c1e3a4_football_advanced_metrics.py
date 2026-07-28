"""advanced football metrics on FootballStat

tackles/interceptions/blocks/clearances/key_passes/shots_on_target/
dribbles_won/duels_won (+ rating) — captured from the API-Football
/fixtures/players sheet; activate defensive-contribution + advanced
attacking scoring.

Revision ID: d5f7b9c1e3a4
Revises: c4e6a8b0d2f3
"""
from alembic import op
import sqlalchemy as sa


revision = "d5f7b9c1e3a4"
down_revision = "c4e6a8b0d2f3"
branch_labels = None
depends_on = None

_INT_COLS = [
    "tackles", "interceptions", "blocks", "clearances",
    "key_passes", "shots_on_target", "dribbles_won", "duels_won",
]


def upgrade() -> None:
    for col in _INT_COLS:
        op.add_column("football_stats", sa.Column(col, sa.SmallInteger(), nullable=False, server_default="0"))
    op.add_column("football_stats", sa.Column("rating", sa.Numeric(precision=4, scale=2), nullable=True))


def downgrade() -> None:
    op.drop_column("football_stats", "rating")
    for col in _INT_COLS:
        op.drop_column("football_stats", col)

"""add scoring_rule_edit admin audit action

Revision ID: e6a8c0d2f4b5
Revises: d5f7b9c1e3a4
"""
from alembic import op


revision = "e6a8c0d2f4b5"
down_revision = "d5f7b9c1e3a4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # New enum value for admin auditing of scoring-rule edits. IF NOT EXISTS so
    # re-runs are safe; PG12+ allows ADD VALUE inside the migration transaction.
    op.execute("ALTER TYPE adminactiontype_enum ADD VALUE IF NOT EXISTS 'scoring_rule_edit'")


def downgrade() -> None:
    # Postgres has no DROP VALUE; leaving the enum value in place is harmless.
    pass

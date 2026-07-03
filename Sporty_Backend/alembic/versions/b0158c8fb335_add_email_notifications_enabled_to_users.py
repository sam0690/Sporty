"""add email_notifications_enabled to users

Revision ID: b0158c8fb335
Revises: a8b9c0d1e2f3
Create Date: 2026-07-03 20:41:40.440715

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b0158c8fb335'
down_revision: Union[str, Sequence[str], None] = 'a8b9c0d1e2f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = {col["name"] for col in inspector.get_columns("users")}
    if "email_notifications_enabled" not in existing_columns:
        op.add_column('users', sa.Column('email_notifications_enabled', sa.Boolean(), server_default='true', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_columns = {col["name"] for col in inspector.get_columns("users")}
    if "email_notifications_enabled" in existing_columns:
        op.drop_column('users', 'email_notifications_enabled')

"""add real_team_logo_url to players

Revision ID: dd69edd8db7d
Revises: 9e36efaf1840
Create Date: 2026-07-04 08:17:49.941425

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'dd69edd8db7d'
down_revision: Union[str, Sequence[str], None] = '9e36efaf1840'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    player_columns = {col["name"] for col in inspector.get_columns("players")}
    if "real_team_logo_url" not in player_columns:
        op.add_column('players', sa.Column('real_team_logo_url', sa.String(length=500), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    player_columns = {col["name"] for col in inspector.get_columns("players")}
    if "real_team_logo_url" in player_columns:
        op.drop_column('players', 'real_team_logo_url')

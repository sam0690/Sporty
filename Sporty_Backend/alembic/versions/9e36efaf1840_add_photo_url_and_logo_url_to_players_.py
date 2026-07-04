"""add photo_url and logo_url to players and real_teams

Revision ID: 9e36efaf1840
Revises: b0158c8fb335
Create Date: 2026-07-03 21:36:31.680431

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '9e36efaf1840'
down_revision: Union[str, Sequence[str], None] = 'b0158c8fb335'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    player_columns = {col["name"] for col in inspector.get_columns("players")}
    if "photo_url" not in player_columns:
        op.add_column('players', sa.Column('photo_url', sa.String(length=500), nullable=True))

    team_columns = {col["name"] for col in inspector.get_columns("real_teams")}
    if "logo_url" not in team_columns:
        op.add_column('real_teams', sa.Column('logo_url', sa.String(length=500), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    team_columns = {col["name"] for col in inspector.get_columns("real_teams")}
    if "logo_url" in team_columns:
        op.drop_column('real_teams', 'logo_url')

    player_columns = {col["name"] for col in inspector.get_columns("players")}
    if "photo_url" in player_columns:
        op.drop_column('players', 'photo_url')

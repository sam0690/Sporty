"""user favourites per sport

Revision ID: 918c7baf710b
Revises: fc7c3576ed77
Create Date: 2026-07-08 10:05:40.732364

"""
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '918c7baf710b'
down_revision: Union[str, Sequence[str], None] = 'fc7c3576ed77'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# NOTE: autogenerate also proposed dropping ix_match_feed_cache_match_id,
# dropping ix_players_name_trgm, and adding ix_real_teams_external_api_id —
# pre-existing index-level drift unrelated to this change (same kind of
# drift called out in 579db2a81210). Deliberately excluded; trimmed by hand
# to only the user-favourites-per-sport change.


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('user_favourite_teams',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('sport_id', sa.UUID(), nullable=False),
    sa.Column('real_team_id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['real_team_id'], ['real_teams.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['sport_id'], ['sports.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'sport_id', name='uq_user_favourite_team_sport')
    )
    op.create_index(op.f('ix_user_favourite_teams_sport_id'), 'user_favourite_teams', ['sport_id'], unique=False)
    op.create_index(op.f('ix_user_favourite_teams_user_id'), 'user_favourite_teams', ['user_id'], unique=False)
    op.create_table('user_favourite_players',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('sport_id', sa.UUID(), nullable=False),
    sa.Column('player_id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['player_id'], ['players.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['sport_id'], ['sports.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'sport_id', name='uq_user_favourite_player_sport')
    )
    op.create_index(op.f('ix_user_favourite_players_sport_id'), 'user_favourite_players', ['sport_id'], unique=False)
    op.create_index(op.f('ix_user_favourite_players_user_id'), 'user_favourite_players', ['user_id'], unique=False)

    # Backfill: migrate each user's single favourite_team_id/favourite_player_id
    # (added in 579db2a81210, one day before this migration) into the new
    # per-sport tables before dropping the old columns. Sport is derived from
    # the favourited team/player's own sport_id.
    bind = op.get_bind()

    team_rows = bind.execute(sa.text(
        "SELECT u.id AS user_id, rt.sport_id AS sport_id, u.favourite_team_id AS real_team_id "
        "FROM users u JOIN real_teams rt ON rt.id = u.favourite_team_id "
        "WHERE u.favourite_team_id IS NOT NULL"
    )).fetchall()
    if team_rows:
        bind.execute(
            sa.text(
                "INSERT INTO user_favourite_teams (id, user_id, sport_id, real_team_id, created_at) "
                "VALUES (:id, :user_id, :sport_id, :real_team_id, now())"
            ),
            [
                {
                    "id": str(uuid.uuid4()),
                    "user_id": row.user_id,
                    "sport_id": row.sport_id,
                    "real_team_id": row.real_team_id,
                }
                for row in team_rows
            ],
        )

    player_rows = bind.execute(sa.text(
        "SELECT u.id AS user_id, p.sport_id AS sport_id, u.favourite_player_id AS player_id "
        "FROM users u JOIN players p ON p.id = u.favourite_player_id "
        "WHERE u.favourite_player_id IS NOT NULL"
    )).fetchall()
    if player_rows:
        bind.execute(
            sa.text(
                "INSERT INTO user_favourite_players (id, user_id, sport_id, player_id, created_at) "
                "VALUES (:id, :user_id, :sport_id, :player_id, now())"
            ),
            [
                {
                    "id": str(uuid.uuid4()),
                    "user_id": row.user_id,
                    "sport_id": row.sport_id,
                    "player_id": row.player_id,
                }
                for row in player_rows
            ],
        )

    op.drop_index(op.f('ix_users_favourite_player_id'), table_name='users')
    op.drop_index(op.f('ix_users_favourite_team_id'), table_name='users')
    op.drop_constraint(op.f('users_favourite_team_id_fkey'), 'users', type_='foreignkey')
    op.drop_constraint(op.f('users_favourite_player_id_fkey'), 'users', type_='foreignkey')
    op.drop_column('users', 'favourite_player_id')
    op.drop_column('users', 'favourite_team_id')


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('users', sa.Column('favourite_team_id', sa.UUID(), autoincrement=False, nullable=True))
    op.add_column('users', sa.Column('favourite_player_id', sa.UUID(), autoincrement=False, nullable=True))
    op.create_foreign_key(op.f('users_favourite_player_id_fkey'), 'users', 'players', ['favourite_player_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key(op.f('users_favourite_team_id_fkey'), 'users', 'real_teams', ['favourite_team_id'], ['id'], ondelete='SET NULL')
    op.create_index(op.f('ix_users_favourite_team_id'), 'users', ['favourite_team_id'], unique=False)
    op.create_index(op.f('ix_users_favourite_player_id'), 'users', ['favourite_player_id'], unique=False)

    # Best-effort reverse backfill: a user can have one favourite per sport
    # now, so collapsing back to a single global favourite is inherently
    # lossy — arbitrarily keeps whichever was created most recently per user.
    bind = op.get_bind()
    bind.execute(sa.text(
        "UPDATE users u SET favourite_team_id = t.real_team_id "
        "FROM (SELECT DISTINCT ON (user_id) user_id, real_team_id FROM user_favourite_teams "
        "ORDER BY user_id, created_at DESC) t "
        "WHERE t.user_id = u.id"
    ))
    bind.execute(sa.text(
        "UPDATE users u SET favourite_player_id = p.player_id "
        "FROM (SELECT DISTINCT ON (user_id) user_id, player_id FROM user_favourite_players "
        "ORDER BY user_id, created_at DESC) p "
        "WHERE p.user_id = u.id"
    ))

    op.drop_index(op.f('ix_user_favourite_players_user_id'), table_name='user_favourite_players')
    op.drop_index(op.f('ix_user_favourite_players_sport_id'), table_name='user_favourite_players')
    op.drop_table('user_favourite_players')
    op.drop_index(op.f('ix_user_favourite_teams_user_id'), table_name='user_favourite_teams')
    op.drop_index(op.f('ix_user_favourite_teams_sport_id'), table_name='user_favourite_teams')
    op.drop_table('user_favourite_teams')

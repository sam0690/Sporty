"""add real_teams and player real_team_id

Revision ID: 3a7f4f9e1c2d
Revises: c8e1f7d4b2a9
Create Date: 2026-05-09 00:00:00.000000
"""

from __future__ import annotations

import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = "3a7f4f9e1c2d"
down_revision = "c8e1f7d4b2a9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "real_teams",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("sport_id", UUID(as_uuid=True), sa.ForeignKey("sports.id"), nullable=False),
        sa.Column("external_api_id", sa.String(length=100), nullable=True),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("abbreviation", sa.String(length=20), nullable=True),
        sa.Column("city", sa.String(length=100), nullable=True),
        sa.Column("conference", sa.String(length=50), nullable=True),
        sa.Column("division", sa.String(length=50), nullable=True),
        sa.UniqueConstraint("sport_id", "name", name="uq_real_team_sport_name"),
        sa.UniqueConstraint("sport_id", "external_api_id", name="uq_real_team_sport_external"),
    )
    op.create_index("ix_real_teams_sport_id", "real_teams", ["sport_id"], unique=False)
    op.create_index("ix_real_teams_name", "real_teams", ["name"], unique=False)

    op.add_column(
        "players",
        sa.Column("real_team_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_index("ix_players_real_team_id", "players", ["real_team_id"], unique=False)

    conn = op.get_bind()
    team_rows = conn.execute(
        sa.text(
            "SELECT DISTINCT sport_id, real_team FROM players WHERE real_team IS NOT NULL AND real_team <> ''"
        )
    ).fetchall()

    team_lookup: dict[tuple[str, str], str] = {}
    for sport_id, real_team in team_rows:
        team_id = str(uuid.uuid4())
        team_lookup[(str(sport_id), str(real_team))] = team_id
        conn.execute(
            sa.text(
                "INSERT INTO real_teams (id, sport_id, name) VALUES (:id, :sport_id, :name)"
            ),
            {"id": team_id, "sport_id": str(sport_id), "name": str(real_team)},
        )

    player_rows = conn.execute(
        sa.text("SELECT id, sport_id, real_team FROM players WHERE real_team IS NOT NULL AND real_team <> ''")
    ).fetchall()
    for player_id, sport_id, real_team in player_rows:
        team_id = team_lookup.get((str(sport_id), str(real_team)))
        if team_id is None:
            continue
        conn.execute(
            sa.text("UPDATE players SET real_team_id = :team_id WHERE id = :player_id"),
            {"team_id": team_id, "player_id": str(player_id)},
        )

    op.create_foreign_key(
        "fk_players_real_team_id_real_teams",
        "players",
        "real_teams",
        ["real_team_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_players_real_team_id_real_teams", "players", type_="foreignkey")
    op.drop_index("ix_players_real_team_id", table_name="players")
    op.drop_column("players", "real_team_id")
    op.drop_index("ix_real_teams_name", table_name="real_teams")
    op.drop_index("ix_real_teams_sport_id", table_name="real_teams")
    op.drop_table("real_teams")

"""Delete phantom cross-sport TeamWeeklyScore rows.

The scoring sweep used to score multisport leagues under foreign-sport
window ids (a basketball window for a league whose season_id is football's),
writing 0-point TeamWeeklyScore rows the league's lineups never lived under.
Symptoms: duplicate gameweek bars on the dashboard, diluted averages, and
everyone-ranks-#1 phantom rows in power rankings. The engine now translates
to the league-native window (see score_transfer_window_for_league); this
removes the rows already written.

Predicate is sport-based, not season-id-based, so dynasty/keeper leagues'
prior-season history (same sport, older season) is untouched: a row is a
phantom iff its window belongs to a season of a DIFFERENT sport than the
league's own season's sport.

Revision ID: d4e8f1a2b3c6
Revises: c9d2e8f4a107
Create Date: 2026-07-14
"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "d4e8f1a2b3c6"
down_revision = "c9d2e8f4a107"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DELETE FROM team_weekly_scores tws
        USING transfer_windows tw,
              seasons window_season,
              fantasy_teams ft,
              leagues l,
              seasons league_season
        WHERE tws.transfer_window_id = tw.id
          AND tw.season_id = window_season.id
          AND tws.fantasy_team_id = ft.id
          AND ft.league_id = l.id
          AND l.season_id = league_season.id
          AND window_season.sport_id <> league_season.sport_id
        """
    )


def downgrade() -> None:
    # Data-only cleanup of rows that should never have existed; nothing to
    # restore.
    pass

"""One-time backfill: set LeagueSport.season_id for every existing row that
predates the explicit cross-sport season mapping (was previously inferred by
exact date-equality between Season rows -- see app/services/scoring/
window_locator.py).

Gap-filling only: only touches rows where season_id IS NULL. create_league
and add_sport now resolve this at creation time and hard-block if no current
season exists, so this script exists purely to catch pre-existing rows —
concretely today that's the two active multisport leagues ("Sachits League",
"multisport") whose basketball LeagueSport row predates this column.

Must run in the same deploy as the schema + matching-logic change: a live
league with a NULL season_id after that ships would immediately trip the
new loud-failure path in _score_player_stats_once_per_sport.

Usage:
    venv/bin/python -m scripts.backfill_league_sport_seasons --dry-run
    venv/bin/python -m scripts.backfill_league_sport_seasons
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

load_dotenv()

# Import all model modules so SQLAlchemy resolves relationships before querying.
from app.auth.models import RefreshToken, User  # noqa: E402,F401
from app.league.models import (  # noqa: E402,F401
    FantasyTeam,
    League,
    LeagueMembership,
    LeagueSport,
    LineupSlot,
    Season,
    Sport,
    TeamGameweekLineup,
    TeamPlayer,
    TeamWeeklyScore,
    Transfer,
    TransferWindow,
)
from app.league.league_service import _current_season_for_sport  # noqa: E402
from app.match.models import Match  # noqa: E402,F401
from app.player.models import (  # noqa: E402,F401
    CricketStat,
    FootballStat,
    Player,
    PlayerGameweekStat,
    RealTeam,
)
from app.player.models_nba import NBAStat  # noqa: E402,F401
from app.scoring.models import DefaultScoringRule  # noqa: E402,F401


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Print what would change without writing to the database.",
    )
    args = parser.parse_args()

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL not found in environment")
        raise SystemExit(1)

    engine = create_engine(database_url)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    try:
        unmapped = (
            db.query(LeagueSport)
            .filter(LeagueSport.season_id.is_(None))
            .all()
        )

        if not unmapped:
            print("No LeagueSport rows need backfilling — every row already has a season_id.")
            return

        resolved = 0
        unresolved = 0
        for league_sport in unmapped:
            league = db.query(League).filter(League.id == league_sport.league_id).first()
            sport = db.query(Sport).filter(Sport.id == league_sport.sport_id).first()
            current_season = _current_season_for_sport(db, league_sport.sport_id)

            if current_season is None:
                unresolved += 1
                print(
                    f"  SKIP league={league.name if league else league_sport.league_id!r} "
                    f"sport={sport.name if sport else league_sport.sport_id!r}: "
                    f"no current season exists for this sport"
                )
                continue

            resolved += 1
            print(
                f"  {league.name if league else league_sport.league_id!r} / "
                f"{sport.name if sport else league_sport.sport_id!r} -> {current_season.name} "
                f"({current_season.start_date} .. {current_season.end_date})"
            )
            if not args.dry_run:
                league_sport.season_id = current_season.id

        print(f"\n{resolved} resolved, {unresolved} skipped (no current season available).")
        if args.dry_run:
            db.rollback()
            print("Dry run — no changes written.")
        else:
            db.commit()
            print("Committed.")
    finally:
        db.close()


if __name__ == "__main__":
    main()

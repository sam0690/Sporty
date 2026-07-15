"""One-off: generate transfer windows for current/upcoming seasons that have
none yet.

Transfer window generation moved from a per-league, owner-triggered action to
a season-scoped, admin-owned one (POST /admin/seasons/{id}/generate-windows —
see app/services/transfer_window_service.py). Seasons created before that
change may still have zero windows, which blocks every budget-mode league on
them from ever reaching ACTIVE (see the SETUP->ACTIVE guard in
app/league/league_service.py::update_league_status and
app/services/league_status_service.py::auto_update_league_statuses).

Gap-filling only: skips any season that already has windows (whether
generated via the old league-triggered path or the new admin path) — it
never rewrites existing windows. Skips seasons whose status is "finished"
(nothing left to schedule). All qualifying seasons get the same weekday —
run it once per weekday if different seasons need different days.

Usage:
    venv/bin/python -m scripts.backfill_transfer_windows --transfer-day 1 --dry-run
    venv/bin/python -m scripts.backfill_transfer_windows --transfer-day 1
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
from app.services.transfer_window_service import generate_transfer_windows_for_season  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--transfer-day", type=int, required=True, choices=range(1, 8),
        help="Weekday to generate windows on for every qualifying season (1=Monday..7=Sunday).",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Print what would be generated without writing to the database.",
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
        seasons = db.query(Season).order_by(Season.start_date).all()
        candidates = [
            s for s in seasons
            if s.status != "finished" and s.total_windows == 0
        ]

        if not candidates:
            print("No seasons need backfilling — every current/upcoming season already has windows.")
            return

        for season in candidates:
            print(
                f"  {season.sport_name or season.sport_id} — {season.name} "
                f"[{season.start_date} .. {season.end_date}] ({season.status}): "
                f"generating with transfer_day={args.transfer_day}"
            )
            if not args.dry_run:
                windows = generate_transfer_windows_for_season(db, season, args.transfer_day)
                print(f"    -> {len(windows)} windows generated")

        print(f"\n{len(candidates)} season(s) {'would be' if args.dry_run else ''} backfilled.")
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

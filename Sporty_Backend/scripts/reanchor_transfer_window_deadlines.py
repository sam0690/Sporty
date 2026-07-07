"""One-off: re-anchor transfer-window deadlines to the window START.

Historically some windows were created with END-anchored deadlines
(transfer_deadline_at = end_at - 2h, lineup_deadline_at = end_at - 1h), which
let users edit their team while the gameweek was being played — so the running
gameweek and the "editable" gameweek were the same window.

This script rewrites every transfer window to the canonical START-anchored
convention used by generate_transfer_windows:

    transfer_deadline_at = start_at
    lineup_deadline_at   = start_at + 1 minute

and recomputes transfers_locked / lineup_locked against "now" so an already
in-progress window (e.g. GW5) locks immediately and editing rolls to the next
gameweek. It is idempotent — running it again is a no-op for already-anchored
windows.

Usage:
    venv/bin/python -m scripts.reanchor_transfer_window_deadlines --dry-run
    venv/bin/python -m scripts.reanchor_transfer_window_deadlines
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime, timedelta, timezone
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


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print what would change without writing to the database.",
    )
    args = parser.parse_args()

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("❌ DATABASE_URL not found in environment")
        raise SystemExit(1)

    engine = create_engine(database_url)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()

    now = datetime.now(timezone.utc)
    try:
        windows = db.query(TransferWindow).order_by(TransferWindow.start_at).all()
        changed = 0
        newly_locked = 0

        for w in windows:
            new_transfer = w.start_at
            new_lineup = w.start_at + timedelta(minutes=1)
            new_transfers_locked = new_transfer <= now
            new_lineup_locked = new_lineup <= now

            will_change = (
                w.transfer_deadline_at != new_transfer
                or w.lineup_deadline_at != new_lineup
                or w.transfers_locked != new_transfers_locked
                or w.lineup_locked != new_lineup_locked
            )
            if will_change:
                changed += 1
                if new_lineup_locked and not w.lineup_locked:
                    newly_locked += 1
                print(
                    f"  GW{w.number} [{w.start_at:%Y-%m-%d}]: "
                    f"lineup_deadline {w.lineup_deadline_at:%Y-%m-%d %H:%M} "
                    f"→ {new_lineup:%Y-%m-%d %H:%M} "
                    f"(locked {w.lineup_locked}→{new_lineup_locked})"
                )

            w.transfer_deadline_at = new_transfer
            w.lineup_deadline_at = new_lineup
            w.transfers_locked = new_transfers_locked
            w.lineup_locked = new_lineup_locked

        print(
            f"\n{len(windows)} windows scanned, {changed} need updating "
            f"({newly_locked} newly locked)."
        )
        if args.dry_run:
            db.rollback()
            print("Dry run — no changes written.")
        else:
            db.commit()
            print("✅ Committed.")
    finally:
        db.close()


if __name__ == "__main__":
    main()

"""Seed Season + weekly TransferWindows.

Usage:
  python scripts/seed_season_and_windows.py "Season 2026" 2026-03-17 2026-06-17 7

Behavior:
- Creates (or updates) one Season per active Sport using the provided name.
- Creates (or upserts) TransferWindow rows that cover the date range with a
  fixed window length (in days).

Notes:
- Season.start_date/end_date are DATEs.
- TransferWindow start/end are timezone-aware UTC datetimes.
- Deadlines follow the existing convention used in league services:
    transfer_deadline_at = end_at - 2h
    lineup_deadline_at   = end_at - 1h

Requires:
- DATABASE_URL in env or .env
"""

from __future__ import annotations

import os
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import sessionmaker

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

load_dotenv()

from app.league.models import Season, Sport, TransferWindow  # noqa: E402


def _parse_date(s: str) -> date:
    return date.fromisoformat(s)


def _day_start_utc(d: date) -> datetime:
    return datetime.combine(d, datetime.min.time()).replace(tzinfo=timezone.utc)


def seed_season_and_windows(
    *,
    season_name: str,
    start_date: date,
    end_date: date,
    window_days: int,
) -> None:
    if window_days <= 0:
        raise ValueError("window_days must be > 0")
    if start_date >= end_date:
        raise ValueError("start_date must be < end_date")

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("❌ DATABASE_URL not found in environment variables")
        raise SystemExit(1)

    engine = create_engine(database_url)
    SessionLocal = sessionmaker(bind=engine)

    db = SessionLocal()
    try:
        sports = db.query(Sport).filter(Sport.is_active.is_(True)).all()
        if not sports:
            print("⚠️  No active sports found. Run scripts/create_sports.py first.")
            return

        total_seasons = 0
        total_windows = 0

        for sport in sports:
            # Create or update Season (unique by sport_id + name)
            season = (
                db.query(Season)
                .filter(Season.sport_id == sport.id, Season.name == season_name)
                .first()
            )
            if not season:
                season = Season(
                    sport_id=sport.id,
                    name=season_name,
                    start_date=start_date,
                    end_date=end_date,
                    is_active=True,
                )
                db.add(season)
                db.flush()  # ensure season.id
                total_seasons += 1
            else:
                season.start_date = start_date
                season.end_date = end_date
                season.is_active = True

            # Upsert windows by (season_id, number)
            tw_table = TransferWindow.__table__
            current = start_date
            number = 1

            while current <= end_date:
                start_at = _day_start_utc(current)
                end_at = start_at + timedelta(days=window_days) - timedelta(seconds=1)

                # Keep deadlines inside the window
                transfer_deadline = end_at - timedelta(hours=2)
                lineup_deadline = end_at - timedelta(hours=1)

                stmt = (
                    insert(tw_table)
                    .values(
                        {
                            "id": uuid.uuid4(),
                            "season_id": season.id,
                            "number": number,
                            "start_at": start_at,
                            "end_at": end_at,
                            "transfer_deadline_at": transfer_deadline,
                            "lineup_deadline_at": lineup_deadline,
                            "transfers_locked": False,
                            "lineup_locked": False,
                        }
                    )
                    .on_conflict_do_update(
                        index_elements=[tw_table.c.season_id, tw_table.c.number],
                        set_={
                            "start_at": start_at,
                            "end_at": end_at,
                            "transfer_deadline_at": transfer_deadline,
                            "lineup_deadline_at": lineup_deadline,
                        },
                    )
                )
                res = db.execute(stmt)
                total_windows += int(res.rowcount or 0)

                number += 1
                current = current + timedelta(days=window_days)

            print(
                f"✅ Seeded {sport.name} season={season_name} "
                f"({start_date} → {end_date}), windows={number - 1}"
            )

        db.commit()
        print(f"\n✅ Done. Seasons inserted: {total_seasons}, window upserts: {total_windows}.")

    except Exception as e:
        db.rollback()
        print(f"❌ Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) != 5:
        print(
            "Usage: python scripts/seed_season_and_windows.py "
            "\"Season 2026\" 2026-03-17 2026-06-17 7"
        )
        raise SystemExit(2)

    name = sys.argv[1].strip()
    start = _parse_date(sys.argv[2])
    end = _parse_date(sys.argv[3])
    days = int(sys.argv[4])

    seed_season_and_windows(
        season_name=name,
        start_date=start,
        end_date=end,
        window_days=days,
    )

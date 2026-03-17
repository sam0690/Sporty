"""
Main data sync script — Sync all data from external APIs.

This script syncs:
  1. Players (from API-Football, API-NBA, CricAPI)
  2. Matches/fixtures (upcoming and finished)
  3. Stats for finished matches

Usage:
    python scripts/sync_all_data.py [--sport football|basketball|cricket]

Schedule with cron:
    # Daily at 3 AM
    0 3 * * * cd /path/to/Sporty_Backend && /path/to/venv/bin/python scripts/sync_all_data.py
"""

import argparse
import asyncio
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

load_dotenv()

# Import all models FIRST to ensure SQLAlchemy registers them before services load
# This prevents "failed to locate a name" errors in relationships
from app.auth.models import User, RefreshToken  # noqa: F401
from app.league.models import (  # noqa: F401
    Sport, Season, TransferWindow, League, LeagueSport, LineupSlot,
    LeagueMembership, FantasyTeam, TeamPlayer, Transfer, 
    TeamGameweekLineup, TeamWeeklyScore
)
from app.match.models import Match  # noqa: F401
from app.player.models import Player, PlayerGameweekStat, FootballStat, CricketStat  # noqa: F401
from app.scoring.models import DefaultScoringRule, LeagueScoringOverride  # noqa: F401

from app.services.sync.match_sync import (
    sync_basketball_games,
    sync_cricket_matches,
    sync_football_matches,
)
from app.services.sync.player_sync import (
    sync_basketball_players,
    sync_football_players,
)
from app.services.sync.stats_sync import sync_finished_match_stats

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("❌ DATABASE_URL not found in environment variables")
    sys.exit(1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)


async def sync_football(db):
    """Sync all football data."""
    print("\n" + "=" * 60)
    print("⚽ SYNCING FOOTBALL DATA")
    print("=" * 60 + "\n")

    # Sync players (Premier League)
    await sync_football_players(db, league_id=39, season=2024)

    # Sync matches
    await sync_football_matches(db, league_id=39, season=2024)


async def sync_basketball(db):
    """Sync all basketball data."""
    print("\n" + "=" * 60)
    print("🏀 SYNCING BASKETBALL DATA")
    print("=" * 60 + "\n")

    # Sync players
    await sync_basketball_players(db, season=2024)

    # Sync games
    await sync_basketball_games(db, season=2024)


async def sync_cricket(db):
    """Sync all cricket data."""
    print("\n" + "=" * 60)
    print("🏏 SYNCING CRICKET DATA")
    print("=" * 60 + "\n")

    # Sync matches
    await sync_cricket_matches(db)

    # Note: Cricket players are typically synced from match scorecards


async def main(sport: str = None):
    """
    Main sync function.

    Args:
        sport: Specific sport to sync ("football", "basketball", "cricket")
               If None, syncs all sports.
    """
    db = SessionLocal()

    try:
        print("\n" + "=" * 60)
        print("🌍 STARTING DATA SYNC")
        print("=" * 60)

        if sport == "football" or sport is None:
            await sync_football(db)

        if sport == "basketball" or sport is None:
            await sync_basketball(db)

        if sport == "cricket" or sport is None:
            await sync_cricket(db)

        # Sync stats for recently finished matches (all sports)
        if sport is None:
            print("\n" + "=" * 60)
            print("📊 SYNCING FINISHED MATCH STATS")
            print("=" * 60 + "\n")
            await sync_finished_match_stats(db)

        print("\n" + "=" * 60)
        print("🎉 ALL DATA SYNCED SUCCESSFULLY!")
        print("=" * 60 + "\n")

    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback

        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sync data from external APIs")
    parser.add_argument(
        "--sport",
        choices=["football", "basketball", "cricket"],
        help="Sync specific sport only",
    )

    args = parser.parse_args()

    asyncio.run(main(sport=args.sport))

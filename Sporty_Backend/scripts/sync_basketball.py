"""
CLI script to sync basketball fixtures from the BallDontLie API.

Usage:
    python scripts/sync_basketball.py             # fixtures, current NBA season
    python scripts/sync_basketball.py 2025        # fixtures, a specific season
    python scripts/sync_basketball.py --players   # ALSO rebuild the player catalog

--players is destructive: it deletes every basketball Player/RealTeam row and
re-ingests from nba_api, cascading away nba_stats, price history and photos,
and leaving cost at 0. Only pass it when you intend a full catalog rebuild.
"""

import asyncio
import logging
import os
import sys
from datetime import datetime
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

load_dotenv()

# Import all models FIRST to ensure SQLAlchemy registers them
from app.auth.models import User, RefreshToken  # noqa: F401
from app.league.models import Sport, Season, League  # noqa: F401
from app.match.models import Match  # noqa: F401
from app.player.models import Player  # noqa: F401
from app.player.models_nba import NBAStat  # noqa: F401

from app.services.sync.basketball_sync import (
    current_nba_season,
    season_label,
    sync_basketball_games,
    sync_basketball_players,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Get database URL
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("❌ DATABASE_URL not found in environment variables")
    sys.exit(1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)


async def main():
    """Main sync function."""
    args = sys.argv[1:]
    seasons = [int(a) for a in args if a.isdigit()]
    season = seasons[0] if seasons else current_nba_season()

    logger.info("🏀 Starting Basketball Data Sync (BallDontLie)...")
    start_time = datetime.utcnow()

    try:
        # Get database session
        db = SessionLocal()

        try:
            # Players are OPT-IN: sync_basketball_players deletes the whole
            # basketball catalog and rebuilds it from nba_api, which cascades
            # away nba_stats/price history/photos and resets cost to 0. Fixture
            # sync must never drag that along.
            if "--players" in args:
                logger.info("\n📥 Syncing Players (destructive catalog rebuild)...")
                await sync_basketball_players(db)
            else:
                logger.info("\n⏭  Skipping players (pass --players to rebuild the catalog)")

            logger.info(f"\n📥 Syncing Games ({season_label(season)} season)...")
            game_stats = await sync_basketball_games(db, season=season)
            logger.info(
                f"   Total: {game_stats['total']}, New: {game_stats['new']}, "
                f"Updated: {game_stats['updated']}, Errors: {game_stats['errors']}"
            )

        finally:
            db.close()

        # Final summary
        end_time = datetime.utcnow()
        duration = (end_time - start_time).total_seconds()

        logger.info("\n" + "=" * 60)
        logger.info("✓ Basketball Data Sync Complete!")
        logger.info(f"  Duration: {duration:.2f} seconds")
        logger.info(f"  Season: {season_label(season)}")
        logger.info(f"  Games Synced: {game_stats['total']}")
        logger.info("=" * 60)

        return 0

    except Exception as e:
        logger.error(f"✗ Sync failed: {e}", exc_info=True)
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

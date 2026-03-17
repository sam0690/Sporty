"""
CLI script to sync basketball data from BallDontLie API.

Usage:
    python scripts/sync_basketball.py
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

from app.services.sync.basketball_sync import sync_basketball_players, sync_basketball_games

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
    logger.info("🏀 Starting Basketball Data Sync (BallDontLie)...")
    start_time = datetime.utcnow()

    try:
        # Get database session
        db = SessionLocal()

        try:
            # Sync players
            logger.info("\n📥 Syncing Players...")
            player_stats = await sync_basketball_players(db)
            logger.info(
                f"   Total: {player_stats['total']}, New: {player_stats['new']}, "
                f"Updated: {player_stats['updated']}, Errors: {player_stats['errors']}"
            )

            # Sync games for 2024 season
            logger.info("\n📥 Syncing Games (2024 season)...")
            game_stats = await sync_basketball_games(db, season=2024)
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
        logger.info(f"  Players Synced: {player_stats['total']}")
        logger.info(f"  Games Synced: {game_stats['total']}")
        logger.info("=" * 60)

        return 0

    except Exception as e:
        logger.error(f"✗ Sync failed: {e}", exc_info=True)
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)

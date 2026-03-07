"""
Live match stats sync script — Updates stats for currently live matches.

This script should be run frequently (every 2-5 minutes) during match hours
to provide real-time score updates.

Usage:
    python scripts/sync_live_stats.py

Schedule with cron:
    # Every 5 minutes
    */5 * * * * cd /path/to/Sporty_Backend && /path/to/venv/bin/python scripts/sync_live_stats.py
"""

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

from app.services.sync.stats_sync import sync_live_match_stats

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("❌ DATABASE_URL not found in environment variables")
    sys.exit(1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)


async def main():
    """Sync live match stats."""
    db = SessionLocal()

    try:
        await sync_live_match_stats(db)

    except Exception as e:
        print(f"❌ ERROR: {e}")
        import traceback

        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())

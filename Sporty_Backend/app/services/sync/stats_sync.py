"""
Stats sync service — Fetch and sync live/finished match stats.

This service:
  1. Monitors live and recently finished matches
  2. Fetches player statistics from external APIs
  3. Creates/updates PlayerGameweekStat and sport-specific stat records
  4. Calculates fantasy points based on scoring rules

Usage:
    from app.services.sync.stats_sync import sync_finished_match_stats
    
    db = SessionLocal()
    await sync_finished_match_stats(db)
"""

import asyncio
from decimal import Decimal

from sqlalchemy.orm import Session

from app.external_apis.football_api import FootballAPIClient
from app.match.models import Match
from app.player.models import Player

# from app.scoring.models import PlayerGameweekStat, FootballStat


async def sync_finished_match_stats(db: Session):
    """
    Find all recently finished matches and sync their player stats.

    This should be run periodically (e.g., every 15 minutes) to catch
    matches that just finished.
    """
    print("📊 Syncing stats for finished matches...")

    # Find recently finished matches (status = "finished", updated in last hour)
    # This prevents re-processing old matches
    from datetime import datetime, timedelta

    one_hour_ago = datetime.utcnow() - timedelta(hours=1)

    finished_matches = (
        db.query(Match)
        .filter(
            Match.status == "finished",
            Match.updated_at >= one_hour_ago,
        )
        .all()
    )

    if not finished_matches:
        print("  ℹ️  No recently finished matches found.")
        return

    for match in finished_matches:
        if match.sport.name == "football":
            await sync_football_match_stats(db, match)
        elif match.sport.name == "basketball":
            await sync_basketball_match_stats(db, match)
        elif match.sport.name == "cricket":
            await sync_cricket_match_stats(db, match)

    print("✅ Finished match stats synced!")


async def sync_football_match_stats(db: Session, match: Match):
    """
    Fetch player stats for a finished football match.

    Creates PlayerGameweekStat and FootballStat records.
    """
    print(f"  ⚽ Syncing stats: {match.home_team} vs {match.away_team}")

    client = FootballAPIClient()

    try:
        # Fetch match events (goals, assists, cards)
        events_response = await client.get_match_events(
            int(match.external_api_id)
        )
        events = events_response.get("response", [])

        # Fetch player statistics
        stats_response = await client.get_match_stats(int(match.external_api_id))
        teams_stats = stats_response.get("response", [])

        # TODO: Parse events and stats, create PlayerGameweekStat records
        # This requires:
        # 1. Matching players by external_api_id
        # 2. Calculating fantasy points based on scoring rules
        # 3. Creating FootballStat records (goals, assists, clean_sheets, etc.)

        print(f"    ✅ Found {len(events)} events")

    except Exception as e:
        print(f"    ❌ Error syncing football match stats: {e}")


async def sync_basketball_match_stats(db: Session, match: Match):
    """
    Fetch player stats for a finished basketball game.

    Creates PlayerGameweekStat and BasketballStat records.
    """
    print(f"  🏀 Syncing stats: {match.home_team} vs {match.away_team}")

    # TODO: Implement basketball stats sync
    print("    ℹ️  Basketball stats sync not yet implemented.")


async def sync_cricket_match_stats(db: Session, match: Match):
    """
    Fetch player stats for a finished cricket match.

    Creates PlayerGameweekStat and CricketStat records.
    """
    print(f"  🏏 Syncing stats: {match.home_team} vs {match.away_team}")

    # TODO: Implement cricket stats sync
    print("    ℹ️  Cricket stats sync not yet implemented.")


async def sync_live_match_stats(db: Session):
    """
    Find all live matches and update their stats in real-time.

    This should be run frequently (e.g., every 2-5 minutes) during
    match hours to provide live score updates.
    """
    print("🔴 Syncing live match stats...")

    live_matches = db.query(Match).filter(Match.status == "live").all()

    if not live_matches:
        print("  ℹ️  No live matches found.")
        return

    for match in live_matches:
        if match.sport.name == "football":
            await sync_football_match_stats(db, match)
        elif match.sport.name == "basketball":
            await sync_basketball_match_stats(db, match)
        elif match.sport.name == "cricket":
            await sync_cricket_match_stats(db, match)

    print("✅ Live match stats synced!")

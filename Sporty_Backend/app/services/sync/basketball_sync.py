"""
Basketball data sync service.

Players and teams are ingested from nba_api via the shared sync helper.
Game syncing still uses the existing BallDontLie flow.
"""

import asyncio
import logging
from datetime import datetime, date

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.redis import cache_get, cache_set, cache_pattern_delete
from app.match.models import Match
from app.league.models import Sport, Season
from app.services.sync.player_sync import sync_basketball_players

logger = logging.getLogger(__name__)


async def sync_basketball_games(db: Session, season: int = 2024) -> dict:
    """
    Sync all NBA games for a season from BallDontLie API.

    Args:
        db: SQLAlchemy Session for database operations
        season: NBA season year (default: 2024)

    Returns:
        Dict with sync statistics: {total: int, new: int, updated: int, errors: int}
    """
    logger.info(f"🏀 Starting basketball games sync for season {season}...")
    stats = {"total": 0, "new": 0, "updated": 0, "errors": 0}

    try:
        # Get Basketball sport
        sport = db.query(Sport).filter(Sport.name == "basketball").first()

        if not sport:
            logger.error("Basketball sport not found in database")
            return stats

        # Get a season for basketball that is active (we'll use the first active season)
        # In reality, you'd map the year to a specific Season record
        # For now, just get any active season for basketball
        season_obj = (
            db.query(Season)
            .filter((Season.sport_id == sport.id) & (Season.is_active == True))
            .first()
        )

        if not season_obj:
            logger.error(f"No active basketball season found in database")
            logger.warning("Creating a default season for basketball games...")
            # Instead of failing, we'll just skip game sync
            # In production, you'd create seasons via a separate management command
            return stats

        # Initialize API client lazily so importing this module does not require
        # the optional BallDontLie dependency unless game sync is used.
        from app.external_apis.basketball_balldontlie import BasketballBallDontLieClient

        api_client = BasketballBallDontLieClient(api_key=settings.BALLDONTLIE_API_KEY)

        # Fetch all games from BallDontLie
        games_data = await api_client.get_all_games(season=season, use_cache=True)
        logger.info(f"Fetched {len(games_data)} games from BallDontLie")

        for game_data in games_data:
            try:
                external_id = game_data.get("id")
                home_team_id = game_data.get("home_team_id")
                visitor_team_id = game_data.get("visitor_team_id")
                game_date = game_data.get("date")

                if not external_id or not home_team_id or not visitor_team_id:
                    logger.warning(f"Skipping game with incomplete data: {game_data}")
                    stats["errors"] += 1
                    continue

                # Check if match already exists
                existing_match = (
                    db.query(Match)
                    .filter(Match.external_api_id == str(external_id))
                    .first()
                )

                if existing_match:
                    # Update existing match
                    existing_match.updated_at = datetime.utcnow()
                    stats["updated"] += 1
                    logger.debug(f"Updated match: {external_id}")
                else:
                    # Create new match
                    new_match = Match(
                        season_id=season_obj.id,
                        external_api_id=str(external_id),
                        match_date=game_date if game_date else datetime.utcnow(),
                        status="scheduled",
                    )
                    db.add(new_match)
                    stats["new"] += 1
                    logger.debug(f"Added match: {external_id}")

                stats["total"] += 1

            except Exception as e:
                logger.error(f"Error processing game {game_data}: {e}")
                stats["errors"] += 1
                continue

        # Commit all changes
        db.commit()
        logger.info(f"✓ Basketball games sync complete: {stats}")

        # Update cache with last sync time
        cache_set(
            f"sync:basketball:games:season:{season}:last_sync",
            {"timestamp": datetime.utcnow().isoformat()},
            ttl_seconds=86400,  # 24 hours
        )

        return stats

    except Exception as e:
        logger.error(f"✗ Basketball games sync failed: {e}")
        db.rollback()
        return stats

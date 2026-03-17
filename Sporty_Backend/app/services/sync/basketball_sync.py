"""
Basketball data sync service — Syncs NBA players and games from BallDontLie API.

Usage:
    from app.services.sync.basketball_sync import sync_basketball_players, sync_basketball_games
    
    db = SessionLocal()
    await sync_basketball_players(db)
    await sync_basketball_games(db, season=2024)
"""

import asyncio
import logging
from datetime import datetime, date

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.redis import cache_get, cache_set, cache_pattern_delete
from app.external_apis.basketball_balldontlie import BasketballBallDontLieClient
from app.match.models import Match
from app.player.models import Player
from app.league.models import Sport, Season

logger = logging.getLogger(__name__)


async def sync_basketball_players(db: Session) -> dict:
    """
    Sync all NBA players from BallDontLie API.

    Args:
        db: SQLAlchemy Session for database operations

    Returns:
        Dict with sync statistics: {total: int, new: int, updated: int, errors: int}
    """
    logger.info("🏀 Starting basketball players sync...")
    stats = {"total": 0, "new": 0, "updated": 0, "errors": 0}

    try:
        # Get Basketball sport
        sport = db.query(Sport).filter(Sport.name == "basketball").first()

        if not sport:
            logger.error("Basketball sport not found in database")
            return stats

        # Initialize API client
        api_client = BasketballBallDontLieClient(api_key=settings.BALLDONTLIE_API_KEY)

        # Fetch all players from BallDontLie
        players_data = await api_client.get_all_players(use_cache=True)
        logger.info(f"Fetched {len(players_data)} players from BallDontLie")

        for player_data in players_data:
            try:
                external_id = player_data.get("id")
                first_name = player_data.get("first_name", "")
                last_name = player_data.get("last_name", "")
                position = player_data.get("position", "")

                if not external_id or not first_name or not last_name:
                    logger.warning(f"Skipping player with incomplete data: {player_data}")
                    stats["errors"] += 1
                    continue

                # Combine names if model expects a single name field
                full_name = f"{first_name} {last_name}".strip()

                # Check if player already exists
                existing_player = (
                    db.query(Player)
                    .filter(Player.external_api_id == str(external_id))
                    .first()
                )

                if existing_player:
                    # Update existing player
                    existing_player.name = full_name
                    if position:
                        existing_player.position = position
                    existing_player.updated_at = datetime.utcnow()
                    stats["updated"] += 1
                    logger.debug(f"Updated player: {full_name}")
                else:
                    # Create new player
                    new_player = Player(
                        sport_id=sport.id,
                        name=full_name,
                        position=position or "Unknown",
                        real_team="NBA",
                        cost=0,  # Default cost, can be updated later
                        external_api_id=str(external_id),
                    )
                    db.add(new_player)
                    stats["new"] += 1
                    logger.debug(f"Added player: {full_name}")

                stats["total"] += 1

            except Exception as e:
                logger.error(f"Error processing player {player_data}: {e}")
                stats["errors"] += 1
                continue

        # Commit all changes
        db.commit()
        logger.info(f"✓ Basketball players sync complete: {stats}")

        # Update cache with last sync time
        cache_set(
            "sync:basketball:players:last_sync",
            {"timestamp": datetime.utcnow().isoformat()},
            ttl_seconds=86400,  # 24 hours
        )

        return stats

    except Exception as e:
        logger.error(f"✗ Basketball players sync failed: {e}")
        db.rollback()
        return stats


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

        # Initialize API client
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

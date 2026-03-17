"""
Basketball API client — BallDontLie (Free NBA API).

Provider: https://www.balldontlie.io/
Free Tier: No rate limits, no authentication required for basic endpoints
Coverage: NBA players, teams, games, stats

Usage:
    client = BasketballBallDontLieClient(api_key)
    players = await client.get_all_players()
    games = await client.get_all_games(season=2024)
    teams = await client.get_teams()
"""

import logging
from typing import Any, Optional

from balldontlie import BalldontlieAPI

from app.core.redis import cache_get, cache_set, cache_pattern_delete

logger = logging.getLogger(__name__)


class BasketballBallDontLieClient:
    """Client for BallDontLie (NBA API). Uses official Python SDK with Redis caching."""

    def __init__(self, api_key: str):
        """
        Initialize BallDontLie client.

        Args:
            api_key: BallDontLie API key
        """
        if not api_key:
            raise ValueError("BallDontLie API key is required")
        
        self.client = BalldontlieAPI(api_key=api_key)
        self.cache_ttl = 3600  # 1 hour for players/teams, configurable per method

    async def get_all_players(self, use_cache: bool = True) -> list[dict[str, Any]]:
        """
        Fetch all NBA players (handles pagination automatically).

        Returns:
            List of all player dictionaries
        """
        cache_key = "basketball:players:all"
        
        if use_cache:
            cached = cache_get(cache_key)
            if cached:
                logger.info(f"Cache hit: {cache_key}")
                return cached.get("data", []) if isinstance(cached, dict) else cached

        all_players = []

        try:
            # Use the balldontlie SDK's list() method which handles pagination
            response = self.client.nba.players.list()
            
            # The balldontlie SDK returns dict-like responses
            cursor = None
            while response is not None:
                # Extract data from response
                if isinstance(response, dict):
                    data = response.get("data", [])
                    meta = response.get("meta", {})
                    cursor = meta.get("next_cursor")
                else:
                    data = []
                    cursor = None
                
                all_players.extend(data)
                logger.debug(f"Fetched {len(data)} players, next_cursor: {cursor}")
                
                # Check if there are more pages
                if cursor:
                    response = self.client.nba.players.list(cursor=cursor)
                else:
                    break

            if use_cache and all_players:
                cache_set(cache_key, {"data": all_players}, self.cache_ttl)
                logger.info(f"Cached {len(all_players)} total players")

            logger.info(f"Fetched {len(all_players)} players from BallDontLie")
            return all_players

        except Exception as e:
            logger.error(f"Error fetching all players: {e}", exc_info=True)
            return all_players  # Return partial results if available

    async def get_all_games(self, season: int = 2024, use_cache: bool = True) -> list[dict[str, Any]]:
        """
        Fetch all NBA games for a season (handles pagination automatically).

        Args:
            season: NBA season year
            use_cache: Whether to use Redis cache

        Returns:
            List of all game dictionaries for the season
        """
        cache_key = f"basketball:games:season:{season}:all"
        
        if use_cache:
            cached = cache_get(cache_key)
            if cached:
                logger.info(f"Cache hit: {cache_key}")
                return cached.get("data", []) if isinstance(cached, dict) else cached

        all_games = []

        try:
            # Use the balldontlie SDK's list() method for games with season filter
            response = self.client.nba.games.list(seasons=[season])
            
            # The balldontlie SDK returns dict-like responses
            cursor = None
            while response is not None:
                # Extract data from response
                if isinstance(response, dict):
                    data = response.get("data", [])
                    meta = response.get("meta", {})
                    cursor = meta.get("next_cursor")
                else:
                    data = []
                    cursor = None
                
                all_games.extend(data)
                logger.debug(f"Fetched {len(data)} games, next_cursor: {cursor}")
                
                # Check if there are more pages
                if cursor:
                    response = self.client.nba.games.list(seasons=[season], cursor=cursor)
                else:
                    break

            if use_cache and all_games:
                cache_set(cache_key, {"data": all_games}, self.cache_ttl)
                logger.info(f"Cached {len(all_games)} total games for season {season}")

            logger.info(f"Fetched {len(all_games)} games from BallDontLie")
            return all_games

        except Exception as e:
            logger.error(f"Error fetching all games: {e}", exc_info=True)
            return all_games  # Return partial results if available

    async def get_teams(self, use_cache: bool = True) -> list[dict[str, Any]]:
        """
        Fetch all NBA teams.

        Returns:
            List of team dictionaries with keys: id, full_name, abbreviation, city, etc.
        """
        cache_key = "basketball:teams:all"
        
        if use_cache:
            cached = cache_get(cache_key)
            if cached:
                logger.info(f"Cache hit: {cache_key}")
                return cached.get("data", []) if isinstance(cached, dict) else cached

        try:
            response = self.client.nba.teams.list()
            teams = response.get("data", []) if isinstance(response, dict) else []
            
            if use_cache and teams:
                cache_set(cache_key, {"data": teams}, 86400)  # Cache teams for 24 hours
                logger.info(f"Cached {len(teams)} teams")
            
            return teams

        except Exception as e:
            logger.error(f"Error fetching teams from BallDontLie: {e}", exc_info=True)
            return []

    async def get_team_by_id(self, team_id: int, use_cache: bool = True) -> Optional[dict[str, Any]]:
        """
        Fetch a specific team by ID.

        Args:
            team_id: BallDontLie team ID
            use_cache: Whether to use Redis cache

        Returns:
            Team dictionary or None if not found
        """
        cache_key = f"basketball:team:{team_id}"
        
        if use_cache:
            cached = cache_get(cache_key)
            if cached:
                logger.info(f"Cache hit: {cache_key}")
                return cached.get("data") if isinstance(cached, dict) else cached

        try:
            response = self.client.nba.teams.get(team_id)
            team = response.get("data", {}) if isinstance(response, dict) else {}
            
            if use_cache and team:
                cache_set(cache_key, {"data": team}, 86400)
                logger.info(f"Cached team {team_id}")
            
            return team if team else None

        except Exception as e:
            logger.error(f"Error fetching team {team_id}: {e}", exc_info=True)
            return None

    async def get_player_by_id(
        self, player_id: int, use_cache: bool = True
    ) -> Optional[dict[str, Any]]:
        """
        Fetch a specific player by ID.

        Args:
            player_id: BallDontLie player ID
            use_cache: Whether to use Redis cache

        Returns:
            Player dictionary or None if not found
        """
        cache_key = f"basketball:player:{player_id}"
        
        if use_cache:
            cached = cache_get(cache_key)
            if cached:
                logger.info(f"Cache hit: {cache_key}")
                return cached.get("data") if isinstance(cached, dict) else cached

        try:
            response = self.client.nba.players.get(player_id)
            player = response.get("data", {}) if isinstance(response, dict) else {}
            
            if use_cache and player:
                cache_set(cache_key, {"data": player}, self.cache_ttl)
                logger.info(f"Cached player {player_id}")
            
            return player if player else None

        except Exception as e:
            logger.error(f"Error fetching player {player_id}: {e}", exc_info=True)
            return None

    async def get_game_stats(
        self, game_id: int, use_cache: bool = True
    ) -> list[dict[str, Any]]:
        """
        Fetch player statistics for a specific game.

        Args:
            game_id: BallDontLie game ID
            use_cache: Whether to use Redis cache

        Returns:
            List of player statistic dictionaries for the game
        """
        cache_key = f"basketball:game_stats:{game_id}"
        
        if use_cache:
            cached = cache_get(cache_key)
            if cached:
                logger.info(f"Cache hit: {cache_key}")
                return cached.get("data", []) if isinstance(cached, dict) else cached

        try:
            response = self.client.nba.stats.list(games=[game_id])
            stats = response.get("data", []) if isinstance(response, dict) else []
            
            if use_cache and stats:
                cache_set(cache_key, {"data": stats}, self.cache_ttl)
                logger.info(f"Cached {len(stats)} stats for game {game_id}")
            
            return stats

        except Exception as e:
            logger.error(f"Error fetching game stats {game_id}: {e}", exc_info=True)
            return []

    def clear_cache(self, pattern: Optional[str] = None) -> None:
        """
        Clear Redis cache for basketball data.

        Args:
            pattern: Optional cache key pattern to clear (default: clears all basketball data)
        """
        pattern = pattern or "basketball:*"
        cache_pattern_delete(pattern)
        logger.info(f"Cleared cache for pattern: {pattern}")

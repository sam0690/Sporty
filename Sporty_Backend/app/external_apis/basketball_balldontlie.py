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

import asyncio
import logging
from typing import Any, Optional

import httpx
from balldontlie import BalldontlieAPI
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.core.redis import cache_get, cache_set, cache_pattern_delete

logger = logging.getLogger(__name__)

# BallDontLie's free tier allows 5 requests/minute. A full NBA season is ~1,300
# games = ~13 pages, so pace the pages rather than discovering the limit via
# 429s. Lower this if you move to a paid key.
PAGE_DELAY_SECONDS = 12.5


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
        
        self.api_key = api_key
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
        Fetch all NBA games for a season (cursor-paginated).

        Hits the REST endpoint rather than the SDK: the SDK's NBAGame model
        drops the `datetime` field (UTC tip-off) and keeps only the US-local
        `date`, but Match.match_date needs the real tip-off for lineup
        deadlines and live-poll windows.

        Args:
            season: NBA season start year (2026 = the 2026-27 season)
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

        all_games: list[dict[str, Any]] = []
        params: dict[str, Any] = {"seasons[]": season, "per_page": 100}

        # The free tier allows 5 requests/minute and a full season is ~13 pages,
        # so 429s are expected mid-pagination, not exceptional.
        @retry(
            stop=stop_after_attempt(8),
            wait=wait_exponential(multiplier=1, min=5, max=60),
            retry=retry_if_exception_type(httpx.HTTPError),
            reraise=True,
        )
        async def _page(http: httpx.AsyncClient, page_params: dict[str, Any]) -> dict:
            response = await http.get(
                "https://api.balldontlie.io/v1/games",
                params=page_params,
                headers={"Authorization": self.api_key},
            )
            response.raise_for_status()
            return response.json()

        async with httpx.AsyncClient(timeout=30.0) as http:
            while True:
                payload = await _page(http, params)
                all_games.extend(payload.get("data", []))

                cursor = (payload.get("meta") or {}).get("next_cursor")
                if not cursor:
                    break
                params = {**params, "cursor": cursor}
                await asyncio.sleep(PAGE_DELAY_SECONDS)

        # Never cache an empty result: before the NBA publishes a schedule this
        # endpoint legitimately returns 0 games, and a cached [] would mask the
        # first successful pull for an hour.
        if use_cache and all_games:
            cache_set(cache_key, {"data": all_games}, self.cache_ttl)

        logger.info(f"Fetched {len(all_games)} games from BallDontLie (season {season})")
        return all_games

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

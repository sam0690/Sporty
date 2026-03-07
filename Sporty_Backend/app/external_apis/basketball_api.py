"""
Basketball API client — API-NBA (RapidAPI).

Provider: https://rapidapi.com/api-sports/api/api-nba
Free Tier: 100 requests/day
Coverage: Players, games, statistics

Usage:
    client = BasketballAPIClient()
    players = await client.get_players(season=2024)
    games = await client.get_games(season=2024)
    stats = await client.get_game_stats(game_id=12345)
"""

import os
from typing import Any, Optional

import httpx
from dotenv import load_dotenv

load_dotenv()


class BasketballAPIClient:
    """Client for API-NBA (RapidAPI)."""

    BASE_URL = "https://api-nba-v1.p.rapidapi.com"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("RAPIDAPI_NBA_KEY")
        if not self.api_key:
            raise ValueError("RAPIDAPI_NBA_KEY not found in environment variables")

        self.headers = {
            "x-rapidapi-host": "api-nba-v1.p.rapidapi.com",
            "x-rapidapi-key": self.api_key,
        }

    async def get_players(self, season: int = 2024) -> dict[str, Any]:
        """
        Fetch all NBA players for a season.

        Returns:
            {"response": [{"id": 123, "firstname": "LeBron", "lastname": "James", ...}]}
        """
        url = f"{self.BASE_URL}/players"
        params = {"season": season}

        async with httpx.AsyncClient() as client:
            response = await client.get(
                url, headers=self.headers, params=params, timeout=30
            )
            response.raise_for_status()
            return response.json()

    async def get_games(
        self, season: int = 2024, team_id: Optional[int] = None
    ) -> dict[str, Any]:
        """
        Fetch NBA games/fixtures for a season.

        Args:
            season: Year (e.g., 2024)
            team_id: Optional team filter

        Returns:
            {"response": [{"id": 12345, "date": {...}, "teams": {...}}, ...]}
        """
        url = f"{self.BASE_URL}/games"
        params = {"season": season}
        if team_id:
            params["team"] = team_id

        async with httpx.AsyncClient() as client:
            response = await client.get(
                url, headers=self.headers, params=params, timeout=30
            )
            response.raise_for_status()
            return response.json()

    async def get_game_stats(self, game_id: int) -> dict[str, Any]:
        """
        Fetch player statistics for a specific game.

        Returns:
            {"response": [{"player": {...}, "points": 30, "rebounds": 8, ...}]}
        """
        url = f"{self.BASE_URL}/players/statistics"
        params = {"game": game_id}

        async with httpx.AsyncClient() as client:
            response = await client.get(
                url, headers=self.headers, params=params, timeout=30
            )
            response.raise_for_status()
            return response.json()

    async def get_live_games(self) -> dict[str, Any]:
        """
        Fetch currently live NBA games.

        Returns:
            {"response": [{"id": 12345, "status": "live", ...}]}
        """
        url = f"{self.BASE_URL}/games"
        params = {"live": "all"}

        async with httpx.AsyncClient() as client:
            response = await client.get(
                url, headers=self.headers, params=params, timeout=30
            )
            response.raise_for_status()
            return response.json()

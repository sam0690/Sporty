"""
Football API client — API-Football (RapidAPI).

Provider: https://rapidapi.com/api-sports/api/api-football
Free Tier: 100 requests/day
Coverage: Players, fixtures, live scores, statistics

Usage:
    client = FootballAPIClient()
    players = await client.get_players(league_id=39, season=2024)
    fixtures = await client.get_fixtures(league_id=39, season=2024)
    stats = await client.get_match_stats(fixture_id=12345)
    live = await client.get_live_fixtures(league_id=39)
"""

import os
from typing import Any, Optional

import httpx
from dotenv import load_dotenv

load_dotenv()


class FootballAPIClient:
    """Client for API-Football (RapidAPI)."""

    BASE_URL = "https://v3.football.api-sports.io"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("RAPIDAPI_FOOTBALL_KEY")
        if not self.api_key:
            raise ValueError(
                "RAPIDAPI_FOOTBALL_KEY not found in environment variables"
            )

        self.headers = {
            "x-rapidapi-host": "v3.football.api-sports.io",
            "x-rapidapi-key": self.api_key,
        }

    async def get_players(
        self, league_id: int = 39, season: int = 2024, page: int = 1
    ) -> dict[str, Any]:
        """
        Fetch all players from a league/season.

        Args:
            league_id: League ID (39 = Premier League, 140 = La Liga)
            season: Year (e.g., 2024)
            page: Pagination page (API-Football returns 20 players per page)

        Returns:
            {"response": [{"player": {...}, "statistics": [...]}], ...}
        """
        url = f"{self.BASE_URL}/players"
        params = {"league": league_id, "season": season, "page": page}

        async with httpx.AsyncClient() as client:
            response = await client.get(
                url, headers=self.headers, params=params, timeout=30
            )
            response.raise_for_status()
            return response.json()

    async def get_fixtures(
        self, league_id: int = 39, season: int = 2024
    ) -> dict[str, Any]:
        """
        Fetch all fixtures/matches for a league/season.

        Returns:
            {"response": [{"fixture": {...}, "teams": {...}, "goals": {...}}, ...]}
        """
        url = f"{self.BASE_URL}/fixtures"
        params = {"league": league_id, "season": season}

        async with httpx.AsyncClient() as client:
            response = await client.get(
                url, headers=self.headers, params=params, timeout=30
            )
            response.raise_for_status()
            return response.json()

    async def get_match_stats(self, fixture_id: int) -> dict[str, Any]:
        """
        Fetch player statistics for a specific match.

        Args:
            fixture_id: External API fixture ID

        Returns:
            {"response": [{"team": {...}, "players": [...]}, ...]}
        """
        url = f"{self.BASE_URL}/fixtures/statistics"
        params = {"fixture": fixture_id}

        async with httpx.AsyncClient() as client:
            response = await client.get(
                url, headers=self.headers, params=params, timeout=30
            )
            response.raise_for_status()
            return response.json()

    async def get_match_events(self, fixture_id: int) -> dict[str, Any]:
        """
        Fetch match events (goals, cards, substitutions).

        Returns:
            {"response": [{"time": {...}, "team": {...}, "player": {...}, "type": "Goal"}, ...]}
        """
        url = f"{self.BASE_URL}/fixtures/events"
        params = {"fixture": fixture_id}

        async with httpx.AsyncClient() as client:
            response = await client.get(
                url, headers=self.headers, params=params, timeout=30
            )
            response.raise_for_status()
            return response.json()

    async def get_live_fixtures(self, league_id: int = 39) -> dict[str, Any]:
        """
        Fetch currently live matches for a league.

        Returns:
            {"response": [{"fixture": {...}, "live": {...}}, ...]}
        """
        url = f"{self.BASE_URL}/fixtures"
        params = {"league": league_id, "live": "all"}

        async with httpx.AsyncClient() as client:
            response = await client.get(
                url, headers=self.headers, params=params, timeout=30
            )
            response.raise_for_status()
            return response.json()

    async def get_player_by_id(
        self, player_id: int, season: int = 2024
    ) -> dict[str, Any]:
        """
        Fetch a specific player's data.

        Returns:
            {"response": [{"player": {...}, "statistics": [...]}]}
        """
        url = f"{self.BASE_URL}/players"
        params = {"id": player_id, "season": season}

        async with httpx.AsyncClient() as client:
            response = await client.get(
                url, headers=self.headers, params=params, timeout=30
            )
            response.raise_for_status()
            return response.json()

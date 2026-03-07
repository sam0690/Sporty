"""
Cricket API client — CricAPI.

Provider: https://www.cricapi.com/
Free Tier: 100 requests/day
Coverage: Matches, player stats, live scores

Usage:
    client = CricketAPIClient()
    matches = await client.get_matches()
    stats = await client.get_match_stats(match_id="abc123")
"""

import os
from typing import Any, Optional

import httpx
from dotenv import load_dotenv

load_dotenv()


class CricketAPIClient:
    """Client for CricAPI."""

    BASE_URL = "https://api.cricapi.com/v1"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("CRICKET_API_KEY")
        if not self.api_key:
            raise ValueError("CRICKET_API_KEY not found in environment variables")

    async def get_matches(self) -> dict[str, Any]:
        """
        Fetch upcoming and live cricket matches.

        Returns:
            {"data": [{"id": "...", "name": "...", "matchType": "...", ...}]}
        """
        url = f"{self.BASE_URL}/matches"
        params = {"apikey": self.api_key}

        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=30)
            response.raise_for_status()
            return response.json()

    async def get_match_info(self, match_id: str) -> dict[str, Any]:
        """
        Fetch detailed info for a specific match.

        Returns:
            {"data": {"id": "...", "name": "...", "teams": [...], ...}}
        """
        url = f"{self.BASE_URL}/match_info"
        params = {"apikey": self.api_key, "id": match_id}

        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=30)
            response.raise_for_status()
            return response.json()

    async def get_match_stats(self, match_id: str) -> dict[str, Any]:
        """
        Fetch player statistics for a match (runs, wickets, catches).

        Returns:
            {"data": {"score": [...], "players": [...]}}
        """
        url = f"{self.BASE_URL}/match_scorecard"
        params = {"apikey": self.api_key, "id": match_id}

        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=30)
            response.raise_for_status()
            return response.json()

    async def get_player_info(self, player_id: str) -> dict[str, Any]:
        """
        Fetch player profile and stats.

        Returns:
            {"data": {"id": "...", "name": "...", "stats": {...}}}
        """
        url = f"{self.BASE_URL}/players_info"
        params = {"apikey": self.api_key, "id": player_id}

        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=30)
            response.raise_for_status()
            return response.json()

    async def get_fantasy_summary(self, match_id: str) -> dict[str, Any]:
        """
        Fetch fantasy points summary for a match.

        Returns:
            {"data": {"players": [{"name": "...", "points": 85, ...}]}}
        """
        url = f"{self.BASE_URL}/fantasySummary"
        params = {"apikey": self.api_key, "id": match_id}

        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=30)
            response.raise_for_status()
            return response.json()

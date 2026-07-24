"""
Football API client — API-Football (api-sports.io v3).

Provider: https://www.api-football.com/ (direct) or via RapidAPI
Free Tier: 100 requests/day, 10 requests/minute
Coverage: Players, fixtures, live scores, events, predictions, statistics

Every request is counted against a daily Redis budget
(settings.FOOTBALL_API_DAILY_BUDGET, default 95 — headroom under the
provider's 100/day hard cap). When the budget is spent, calls raise
FootballQuotaExhausted *before* hitting the network; callers treat it as
"polling paused for today", not an error.

Usage:
    client = FootballAPIClient()
    fixtures = await client.get_fixtures(league_id=39, season=2026)
    live = await client.get_live_fixtures(league_id=39)
    prediction = await client.get_predictions(fixture_id=12345)
"""

import logging
import os
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


class FootballQuotaExhausted(RuntimeError):
    """Daily API-Football request budget is spent; retry after 00:00 UTC."""


def _spend_quota() -> None:
    """INCR the shared daily counter; raise once the budget is spent.

    Counter key rolls with the UTC date to match the provider's 00:00 UTC
    reset. Fails open on Redis errors — the provider's own hard cap is the
    backstop, and losing quota accounting must not stop live data.
    """
    from app.core.config import settings
    from app.core.redis import get_redis

    budget = settings.FOOTBALL_API_DAILY_BUDGET
    if budget <= 0:  # 0 = unlimited (paid plan)
        return
    try:
        redis = get_redis()
        key = f"quota:api-football:{datetime.now(timezone.utc):%Y%m%d}"
        used = redis.incr(key)
        if used == 1:
            redis.expire(key, 172800)  # 2 days; date in the key does the real rollover
    except Exception:  # noqa: BLE001
        logger.warning("API-Football quota counter unavailable; failing open", exc_info=True)
        return
    if used > budget:
        raise FootballQuotaExhausted(
            f"API-Football daily budget spent ({budget}/{budget})"
        )


class FootballAPIClient:
    """Client for API-Football (api-sports.io v3)."""

    BASE_URL = "https://v3.football.api-sports.io"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("FOOTBALL_API_KEY")
        if not self.api_key:
            raise ValueError(
                "FOOTBALL_API_KEY not found in environment variables"
            )

        # Both header schemes: x-apisports-key is what direct api-sports.io
        # accounts use; the x-rapidapi-* pair covers RapidAPI-issued keys.
        self.headers = {
            "x-apisports-key": self.api_key,
            "x-rapidapi-host": "v3.football.api-sports.io",
            "x-rapidapi-key": self.api_key,
        }

    async def _get(self, path: str, params: dict[str, Any]) -> dict[str, Any]:
        _spend_quota()
        url = f"{self.BASE_URL}/{path}"
        async with httpx.AsyncClient() as client:
            response = await client.get(
                url, headers=self.headers, params=params, timeout=30
            )
            response.raise_for_status()
            return response.json()

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
        return await self._get(
            "players", {"league": league_id, "season": season, "page": page}
        )

    async def get_fixtures(
        self, league_id: int = 39, season: int = 2024
    ) -> dict[str, Any]:
        """
        Fetch all fixtures/matches for a league/season.

        Returns:
            {"response": [{"fixture": {...}, "teams": {...}, "goals": {...}}, ...]}
        """
        return await self._get("fixtures", {"league": league_id, "season": season})

    async def get_match_stats(self, fixture_id: int) -> dict[str, Any]:
        """
        Fetch player statistics for a specific match.

        Args:
            fixture_id: External API fixture ID

        Returns:
            {"response": [{"team": {...}, "players": [...]}, ...]}
        """
        return await self._get("fixtures/statistics", {"fixture": fixture_id})

    async def get_match_events(self, fixture_id: int) -> dict[str, Any]:
        """
        Fetch match events (goals, cards, substitutions).

        Returns:
            {"response": [{"time": {...}, "team": {...}, "player": {...}, "type": "Goal"}, ...]}
        """
        return await self._get("fixtures/events", {"fixture": fixture_id})

    async def get_fixtures_by_date(self, day: str) -> dict[str, Any]:
        """
        All fixtures on one YYYY-MM-DD date (UTC), across all leagues — the
        only forward-looking fixtures query the Free plan allows (today ± 1
        day); callers filter by league id client-side.

        Returns:
            {"response": [{"fixture": {...}, "league": {...}, "teams": {...}}, ...]}
        """
        return await self._get("fixtures", {"date": day})

    async def get_live_fixtures(self, league_id: int = 39) -> dict[str, Any]:
        """
        Fetch currently live matches for a league. Each live fixture embeds
        its `events` array, so no per-fixture events call is needed.

        Returns:
            {"response": [{"fixture": {...}, "goals": {...}, "events": [...]}, ...]}
        """
        return await self._get("fixtures", {"league": league_id, "live": "all"})

    async def get_fixture_players(self, fixture_id: int) -> dict[str, Any]:
        """
        Fetch the full per-player stat sheet for one fixture (minutes, goals,
        assists, saves, conceded, cards, penalties, rating).

        Returns:
            {"response": [{"team": {...}, "players": [{"player": {...}, "statistics": [{...}]}]}]}
        """
        return await self._get("fixtures/players", {"fixture": fixture_id})

    async def get_predictions(self, fixture_id: int) -> dict[str, Any]:
        """
        Fetch the pre-match outcome prediction for one fixture.

        Returns:
            {"response": [{"predictions": {"percent": {"home": "45%", ...}, ...}, ...}]}
        """
        return await self._get("predictions", {"fixture": fixture_id})

    async def get_teams(
        self, league_id: int = 39, season: int = 2024
    ) -> dict[str, Any]:
        """
        Fetch all teams (with crest/logo URLs) for a league/season.

        Returns:
            {"response": [{"team": {"id":..., "name":..., "logo": "https://..."}, "venue": {...}}, ...]}
        """
        return await self._get("teams", {"league": league_id, "season": season})

    async def get_player_by_id(
        self, player_id: int, season: int = 2024
    ) -> dict[str, Any]:
        """
        Fetch a specific player's data.

        Returns:
            {"response": [{"player": {...}, "statistics": [...]}]}
        """
        return await self._get("players", {"id": player_id, "season": season})

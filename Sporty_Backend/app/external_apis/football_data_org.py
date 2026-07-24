"""football-data.org v4 client — schedule source for the EPL fixture list.

API-Football's Free plan blocks current-season fixture lists, so the season
schedule comes from football-data.org's free tier instead (full current-season
EPL fixtures, 10 req/min — we make ~1 call/day). Everything else (live scores,
finals, stats, predictions) stays on API-Football.

Register (free, token arrives instantly by email) at
https://www.football-data.org/client/register and set FOOTBALL_DATA_ORG_TOKEN.
"""

from typing import Any

import httpx

from app.core.config import settings

BASE_URL = "https://api.football-data.org/v4"


async def get_pl_matches() -> dict[str, Any]:
    """Full current-season Premier League match list.

    Returns:
        {"matches": [{"id":..., "utcDate":..., "status": "TIMED", "matchday":...,
                      "homeTeam": {"name": "Manchester United FC", ...},
                      "awayTeam": {...}, "season": {...}}, ...]}
    """
    token = settings.FOOTBALL_DATA_ORG_TOKEN
    if not token:
        raise ValueError("FOOTBALL_DATA_ORG_TOKEN not set")
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{BASE_URL}/competitions/PL/matches",
            headers={"X-Auth-Token": token},
            timeout=30,
        )
        response.raise_for_status()
        return response.json()

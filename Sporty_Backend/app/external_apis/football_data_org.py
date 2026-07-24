"""football-data.org v4 client — schedule source for the EPL fixture list.

API-Football's Free plan blocks current-season fixture lists, so the season
schedule comes from football-data.org's free tier instead (full current-season
EPL fixtures, 10 req/min — we make ~1 call/day). Everything else (live scores,
finals, stats, predictions) stays on API-Football.

Register (free, token arrives instantly by email) at
https://www.football-data.org/client/register and set FOOTBALL_DATA_ORG_TOKEN.
"""

import asyncio
import logging
import time
from typing import Any

import httpx

from app.core.config import settings

BASE_URL = "https://api.football-data.org/v4"

logger = logging.getLogger(__name__)

# Automatic throttling off the API's own response headers
# (docs.football-data.org lookup tables → Response Headers):
#   x-requests-available-minute — calls left in the current minute window
#   X-RequestCounter-Reset      — seconds until the window resets
# When the window is spent we note when it reopens and any later call in this
# process sleeps until then instead of burning a 429.
_resume_at = 0.0


async def _fdo_get(path: str) -> dict[str, Any]:
    global _resume_at
    token = settings.FOOTBALL_DATA_ORG_TOKEN
    if not token:
        raise ValueError("FOOTBALL_DATA_ORG_TOKEN not set")

    wait = _resume_at - time.monotonic()
    if wait > 0:
        logger.info("football-data.org throttle: waiting %.0fs for rate window", wait)
        await asyncio.sleep(wait)

    async with httpx.AsyncClient() as client:
        for attempt in (1, 2):
            response = await client.get(
                f"{BASE_URL}/{path}", headers={"X-Auth-Token": token}, timeout=30
            )
            reset = int(response.headers.get("X-RequestCounter-Reset", 60) or 60)
            available = response.headers.get("x-requests-available-minute")
            if available is not None and int(available) <= 0:
                _resume_at = time.monotonic() + reset
            if response.status_code == 429 and attempt == 1:
                logger.warning("football-data.org 429; retrying after %ss", reset)
                await asyncio.sleep(reset)
                continue
            response.raise_for_status()
            return response.json()
    raise RuntimeError("unreachable")  # both attempts returned above or raised


async def get_competition_matches(code: str) -> dict[str, Any]:
    """Full current-season match list for one competition (PL/PD/BL1/...).

    Returns:
        {"matches": [{"id":..., "utcDate":..., "status": "TIMED", "matchday":...,
                      "homeTeam": {"name": "Manchester United FC", ...},
                      "awayTeam": {...}, "season": {...}}, ...]}
    """
    return await _fdo_get(f"competitions/{code}/matches")

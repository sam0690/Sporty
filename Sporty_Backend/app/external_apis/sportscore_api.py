"""
SportScore client — sportscore.com/api/widget/* (live display data only).

Provider: https://sportscore.com/developers/ — keyless, CORS-open, ~10,000
requests/24h/IP, responses edge-cached 60s. Free in exchange for a visible
dofollow "Powered by SportScore" attribution link on pages using the data.

Why this exists alongside FootballAPIClient: API-Football's 100/day cap forces
an HOURLY live poll, so a goal can sit unseen for up to an hour. This provider
costs nothing per request, so it can tick every 60 seconds. What it CANNOT do
is feed scoring — it returns no per-player stats (`stats` is `[]` even on a top
-flight fixture) and no ids of any kind, only display names. API-Football stays
the system of record; see app/services/sync/sportscore_live_sync.py.

Two provider quirks drive this module's shape:

  1. Roughly a QUARTER of requests answer 503 with an HTML "one moment"
     interstitial instead of JSON, even for slugs that worked seconds earlier
     (measured: 2 of 8 at one request per 2s). That is normal operation here,
     not an outage — so a non-JSON body returns None ("no data this tick")
     after a single Retry-After-honouring retry, and never raises.
  2. Match slugs are "{team-a}-vs-{team-b}" using THEIR club naming, and are
     order-insensitive: deportivo-alaves-vs-getafe and getafe-vs-deportivo
     -alaves resolve to the same fixture. See sportscore_teams.py for the map.

Usage:
    client = SportScoreClient()
    match = await client.get_match("deportivo-alaves-vs-getafe")   # dict | None
"""

import asyncio
import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# Their edge caches 60s and our tick is 60s, so a local cache would only ever
# serve what we already have. Deliberately no Redis caching here.
BASE_URL = "https://sportscore.com/api/widget"

# Deliberately tighter than FootballAPIClient's 30s: a 60-second tick has to
# fetch every in-play fixture AND finish inside its own interval, so one slow
# fixture must not eat the tick. Worst case per fixture is 2 x this.
_TIMEOUT_SECONDS = 10.0

# Cap on how long we'll honour their Retry-After before giving up on the tick.
_MAX_RETRY_DELAY_SECONDS = 5.0


class SportScoreClient:
    """Keyless read-only client. No API key, no quota counter, no budget guard —
    there is nothing to spend and nothing to leak."""

    def __init__(self, timeout: float = _TIMEOUT_SECONDS) -> None:
        self.timeout = timeout

    async def _get(self, path: str, params: dict[str, Any]) -> dict[str, Any] | None:
        """Single chokepoint. Returns the parsed payload, or None for any
        outcome that means "no data this tick" — interstitial, timeout,
        transport error, or a body that isn't JSON.

        Never raises: this provider is a display-only enhancement, and a poll
        loop must not die because a third party served us a holding page.
        """
        url = f"{BASE_URL}/{path}"
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for attempt in (1, 2):
                try:
                    response = await client.get(url, params=params)
                except Exception:
                    logger.warning(
                        "SportScore: request failed for %s %s (attempt %s)",
                        path, params, attempt, exc_info=True,
                    )
                    return None

                # The interstitial answers 503 with text/html and Retry-After.
                if response.status_code == 503 and attempt == 1:
                    delay = _retry_after_seconds(response.headers.get("retry-after"))
                    if delay is None:
                        return None
                    await asyncio.sleep(delay)
                    continue

                if response.status_code != 200:
                    logger.info(
                        "SportScore: HTTP %s for %s %s", response.status_code, path, params
                    )
                    return None

                try:
                    payload = response.json()
                except ValueError:
                    # 200 with an HTML body — same holding page, different code.
                    logger.info("SportScore: non-JSON body for %s %s", path, params)
                    return None

                if not isinstance(payload, dict):
                    return None
                # Their errors come back as 200 + {"error": "..."} (e.g. an
                # unknown slug), which is a miss, not data.
                if payload.get("error"):
                    logger.info(
                        "SportScore: %s for %s %s", payload["error"], path, params
                    )
                    return None
                return payload
        return None

    async def get_match(self, slug: str, sport: str = "football") -> dict[str, Any] | None:
        """One fixture: score, status, live_minute, incidents, lineups.

        Returns the inner `match` object, or None. NOTE: one slug serves BOTH
        legs of a season fixture pair, so the caller must validate the payload
        against the fixture it asked about (teams + kickoff) before trusting it.
        """
        payload = await self._get("match/", {"slug": slug, "sport": sport})
        if payload is None:
            return None
        match = payload.get("match")
        return match if isinstance(match, dict) else None

    async def get_team(self, slug: str, sport: str = "football") -> dict[str, Any] | None:
        """A club's fixture list. Only used by the one-off slug-map bootstrap —
        their fixture DATES are unreliable (all "upcoming", synthetic times), so
        this must never be used as a schedule source.
        """
        return await self._get("team/", {"slug": slug, "sport": sport})


def _retry_after_seconds(raw: str | None) -> float | None:
    """Their Retry-After, clamped. None means "don't bother retrying"."""
    if not raw:
        return None
    try:
        delay = float(raw)
    except ValueError:
        return None
    if delay <= 0:
        return None
    return min(delay, _MAX_RETRY_DELAY_SECONDS)

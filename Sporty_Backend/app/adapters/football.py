from __future__ import annotations

from datetime import UTC, datetime
import logging

import httpx
import pybreaker

from app.adapters.base import ISportAdapter
from app.models.schemas.events import EventType, NormalizedEvent, RawEvent, SportType
from app.core.config import settings
from app.services.rate_limiter import RedisTokenBucketLimiter

logger = logging.getLogger(__name__)


class FootballAdapter(ISportAdapter):
    sport = "football"

    def __init__(self) -> None:
        self.breaker = pybreaker.CircuitBreaker(fail_max=5, reset_timeout=30)
        self._limiter = RedisTokenBucketLimiter()
        self._base_url = "https://v3.football.api-sports.io"

    async def _get(self, path: str, params: dict[str, str | int]) -> dict:
        # pybreaker integration for async call-path: fail fast if breaker is open,
        # then mark success/failure around the awaited request.
        self.breaker.call(lambda: True)

        api_key = settings.RAPIDAPI_FOOTBALL_KEY
        if not api_key:
            return {}

        now_ms = int(datetime.now(UTC).timestamp() * 1000)
        allowed = await self._limiter.allow(
            "rate:football:rapidapi",
            now_ms=now_ms,
            rate_per_sec=1.0,
            capacity=5,
        )
        if not allowed:
            logger.debug("Football adapter rate-limited for path=%s", path)
            return {}

        url = f"{self._base_url}{path}"
        headers = {
            "x-rapidapi-host": settings.RAPIDAPI_FOOTBALL_HOST,
            "x-rapidapi-key": api_key,
        }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(url, headers=headers, params=params)
                response.raise_for_status()
                self.breaker.call(lambda: True)
                return response.json()
        except Exception:
            self.breaker.call(lambda: (_ for _ in ()).throw(RuntimeError("football_api_failed")))
            raise

    async def poll(self, match_id: str) -> list[RawEvent]:
        _ = match_id
        fixtures_payload = await self._get(
            "/fixtures",
            {
                "league": settings.FOOTBALL_LIVE_LEAGUE_ID,
                "live": "all",
            },
        )
        fixtures = fixtures_payload.get("response", [])

        output: list[RawEvent] = []
        ts = int(datetime.now(UTC).timestamp() * 1000)

        for fixture in fixtures:
            fixture_info = fixture.get("fixture", {})
            fixture_id = fixture_info.get("id")
            if fixture_id is None:
                continue

            events_payload = await self._get(
                "/fixtures/events",
                {"fixture": int(fixture_id)},
            )
            events = events_payload.get("response", [])

            for event in events:
                event_type = str(event.get("type", "STAT")).upper()
                detail = str(event.get("detail", ""))
                minute = event.get("time", {}).get("elapsed", 0)
                player = event.get("player", {})
                team = event.get("team", {})

                event_id = (
                    f"{fixture_id}:{minute}:{event_type}:"
                    f"{player.get('id') or player.get('name')}:"
                    f"{detail}"
                )

                output.append(
                    RawEvent(
                        sport=SportType.FOOTBALL,
                        match_id=str(fixture_id),
                        type=event_type,
                        payload={
                            "event_id": event_id,
                            "fixture_id": fixture_id,
                            "minute": minute,
                            "detail": detail,
                            "player_id": player.get("id") or player.get("name") or "",
                            "team_id": team.get("id") or team.get("name") or "",
                            "position": player.get("pos"),
                            "raw": event,
                        },
                        timestamp=ts,
                    )
                )

        return output

    def normalize(self, raw: RawEvent) -> NormalizedEvent:
        event_type_map = {
            "GOAL": EventType.GOAL,
            "CARD": EventType.CARD,
            "SUBST": EventType.SUB,
            "SUBSTITUTION": EventType.SUB,
            "STAT": EventType.STAT,
        }
        normalized_type = event_type_map.get(raw.type.upper(), EventType.STAT)

        return NormalizedEvent(
            sport=SportType.FOOTBALL,
            match_id=raw.match_id,
            event_type=normalized_type,
            player_id=str(raw.payload.get("player_id", "")),
            team_id=str(raw.payload.get("team_id", "")),
            value=float(raw.payload.get("value", 0.0)),
            meta=raw.payload,
            ts=raw.timestamp,
            event_id=str(raw.payload.get("event_id", f"{raw.match_id}:{raw.timestamp}")),
        )

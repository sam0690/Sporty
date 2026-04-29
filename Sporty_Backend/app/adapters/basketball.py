from __future__ import annotations

from datetime import UTC, datetime
import logging

import httpx
import pybreaker

from app.adapters.base import ISportAdapter
from app.core.config import settings
from app.models.schemas.events import EventType, NormalizedEvent, RawEvent, SportType
from app.services.rate_limiter import RedisTokenBucketLimiter

logger = logging.getLogger(__name__)


class BasketballAdapter(ISportAdapter):
    sport = "basketball"

    def __init__(self) -> None:
        self.breaker = pybreaker.CircuitBreaker(fail_max=5, reset_timeout=30)
        self._limiter = RedisTokenBucketLimiter()
        self._base_url = f"https://{settings.RAPIDAPI_NBA_HOST}"

    async def _get(self, path: str, params: dict[str, str | int]) -> dict:
        self.breaker.call(lambda: True)
        api_key = settings.RAPIDAPI_NBA_KEY
        if not api_key:
            return {}

        now_ms = int(datetime.now(UTC).timestamp() * 1000)
        allowed = await self._limiter.allow(
            "rate:nba:rapidapi",
            now_ms=now_ms,
            rate_per_sec=1.0,
            capacity=4,
        )
        if not allowed:
            logger.debug("Basketball adapter rate-limited for path=%s", path)
            return {}

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    f"{self._base_url}{path}",
                    headers={
                        "X-RapidAPI-Key": api_key,
                        "X-RapidAPI-Host": settings.RAPIDAPI_NBA_HOST,
                    },
                    params=params,
                )
                response.raise_for_status()
                self.breaker.call(lambda: True)
                return response.json()
        except Exception:
            self.breaker.call(lambda: (_ for _ in ()).throw(RuntimeError("nba_api_failed")))
            raise

    @staticmethod
    def _coerce_float(value, default: float = 0.0) -> float:
        try:
            if value in (None, ""):
                return default
            return float(value)
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _coerce_int(value, default: int = 0) -> int:
        try:
            if value in (None, ""):
                return default
            return int(float(value))
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _status_is_live(game: dict) -> bool:
        status = game.get("status", {}) if isinstance(game.get("status"), dict) else {}
        long_status = str(status.get("long", "")).lower()
        short_status = str(status.get("short", "")).lower()
        return (
            "live" in long_status
            or "in play" in long_status
            or short_status in {"q1", "q2", "q3", "q4", "ot", "ht"}
        )

    async def poll(self, match_id: str) -> list[RawEvent]:
        games_payload = await self._get(
            "/games",
            {
                "league": "standard",
                "season": 2024,
                "live": "all",
            },
        )
        live_games = games_payload.get("response", [])
        if not isinstance(live_games, list):
            return []

        # IngestionWorker now passes external_api_id; keep "all" fallback for safety.
        selected_games: list[dict] = []
        for game in live_games:
            gid = str(game.get("id", ""))
            if not gid:
                continue
            if match_id and match_id != "all" and gid != str(match_id):
                continue
            if not self._status_is_live(game):
                continue
            selected_games.append(game)

        output: list[RawEvent] = []
        ts = int(datetime.now(UTC).timestamp() * 1000)

        for game in selected_games:
            game_id = str(game.get("id"))
            status = game.get("status", {}) if isinstance(game.get("status"), dict) else {}
            minute = self._coerce_int(status.get("clock"), 0)

            stats_payload = await self._get(
                "/players/statistics",
                {"game": game_id},
            )
            stat_rows = stats_payload.get("response", [])
            if not isinstance(stat_rows, list):
                continue

            for row in stat_rows:
                player_obj = row.get("player", {}) if isinstance(row.get("player"), dict) else {}
                team_obj = row.get("team", {}) if isinstance(row.get("team"), dict) else {}

                player_id = str(player_obj.get("id") or "")
                team_id = str(team_obj.get("id") or "")
                if not player_id:
                    continue

                points = self._coerce_float(row.get("points"), 0.0)
                assists = self._coerce_float(row.get("assists"), 0.0)
                rebounds = self._coerce_float(row.get("totReb"), 0.0)
                steals = self._coerce_float(row.get("steals"), 0.0)
                blocks = self._coerce_float(row.get("blocks"), 0.0)
                turnovers = self._coerce_float(row.get("turnovers"), 0.0)

                stat_signature = f"p{points}:a{assists}:r{rebounds}:s{steals}:b{blocks}:t{turnovers}"
                event_id = f"{game_id}:{player_id}:STAT:{stat_signature}"

                output.append(
                    RawEvent(
                        sport=SportType.BASKETBALL,
                        match_id=game_id,
                        type="STAT",
                        payload={
                            "event_id": event_id,
                            "game_id": game_id,
                            "minute": minute,
                            "player_id": player_id,
                            "team_id": team_id,
                            "points": points,
                            "assists": assists,
                            "rebounds": rebounds,
                            "steals": steals,
                            "blocks": blocks,
                            "turnovers": turnovers,
                            "raw": row,
                        },
                        timestamp=ts,
                    )
                )

        return output

    def normalize(self, raw: RawEvent) -> NormalizedEvent:
        event_type_map = {
            "BASKET": EventType.BASKET,
            "2PT": EventType.BASKET,
            "3PT": EventType.BASKET,
            "STAT": EventType.STAT,
            "SUB": EventType.SUB,
        }
        normalized_type = event_type_map.get(raw.type.upper(), EventType.STAT)

        return NormalizedEvent(
            sport=SportType.BASKETBALL,
            match_id=raw.match_id,
            event_type=normalized_type,
            player_id=str(raw.payload.get("player_id", "")),
            team_id=str(raw.payload.get("team_id", "")),
            value=float(raw.payload.get("value", 0.0)),
            meta=raw.payload,
            ts=raw.timestamp,
            event_id=str(raw.payload.get("event_id", f"{raw.match_id}:{raw.timestamp}")),
        )

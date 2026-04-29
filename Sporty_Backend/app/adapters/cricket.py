from __future__ import annotations

from datetime import UTC, datetime
import logging
from typing import Any

import httpx
import pybreaker

from app.adapters.base import ISportAdapter
from app.core.config import settings
from app.models.schemas.events import EventType, NormalizedEvent, RawEvent, SportType
from app.services.rate_limiter import RedisTokenBucketLimiter

logger = logging.getLogger(__name__)


class CricketAdapter(ISportAdapter):
    sport = "cricket"

    def __init__(self) -> None:
        self.breaker = pybreaker.CircuitBreaker(fail_max=5, reset_timeout=30)
        self._limiter = RedisTokenBucketLimiter()
        self._base_url = f"https://{settings.RAPIDAPI_CRICKET_HOST}"

    async def _get(self, path: str) -> dict:
        self.breaker.call(lambda: True)
        api_key = settings.CRICKET_API_KEY
        if not api_key:
            return {}

        now_ms = int(datetime.now(UTC).timestamp() * 1000)
        allowed = await self._limiter.allow(
            "rate:cricket:rapidapi",
            now_ms=now_ms,
            rate_per_sec=1.0,
            capacity=4,
        )
        if not allowed:
            logger.debug("Cricket adapter rate-limited for path=%s", path)
            return {}

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    f"{self._base_url}{path}",
                    headers={
                        "X-RapidAPI-Key": api_key,
                        "X-RapidAPI-Host": settings.RAPIDAPI_CRICKET_HOST,
                    },
                )
                response.raise_for_status()
                self.breaker.call(lambda: True)
                return response.json()
        except Exception:
            self.breaker.call(lambda: (_ for _ in ()).throw(RuntimeError("cricket_api_failed")))
            raise

    @staticmethod
    def _coerce_int(value, default: int = 0) -> int:
        try:
            if value in (None, ""):
                return default
            return int(float(value))
        except (TypeError, ValueError):
            return default

    @classmethod
    def _walk_dicts(cls, node: Any):
        if isinstance(node, dict):
            yield node
            for value in node.values():
                yield from cls._walk_dicts(value)
            return
        if isinstance(node, list):
            for item in node:
                yield from cls._walk_dicts(item)

    @classmethod
    def _extract_live_match_ids(cls, payload: dict) -> list[str]:
        ids: list[str] = []
        for node in cls._walk_dicts(payload):
            candidate = node.get("matchId") or node.get("id")
            state = str(node.get("state", "")).lower()
            status = str(node.get("status", "")).lower()
            if not candidate:
                continue
            # Require a live-ish state marker when present.
            if state and "live" not in state and "in progress" not in state:
                if status and "live" not in status and "in progress" not in status:
                    continue
            ids.append(str(candidate))
        # Preserve order and uniqueness.
        seen = set()
        ordered = []
        for item in ids:
            if item in seen:
                continue
            seen.add(item)
            ordered.append(item)
        return ordered

    async def poll(self, match_id: str) -> list[RawEvent]:
        live_payload = await self._get("/matches/v1/live")
        match_ids = self._extract_live_match_ids(live_payload)
        if match_id and match_id != "all":
            match_ids = [mid for mid in match_ids if mid == str(match_id)]

        output: list[RawEvent] = []
        ts = int(datetime.now(UTC).timestamp() * 1000)

        for live_id in match_ids:
            score_payload = await self._get(f"/mcenter/v1/{live_id}/hscard")

            for node in self._walk_dicts(score_payload):
                player_id = node.get("playerId") or node.get("batterId") or node.get("bowlerId")
                if player_id is None:
                    continue

                runs = self._coerce_int(node.get("runs") or node.get("r"), 0)
                wickets = self._coerce_int(node.get("wickets") or node.get("w"), 0)
                balls = self._coerce_int(node.get("balls") or node.get("b"), 0)
                team_id = str(node.get("teamId") or node.get("batTeamId") or node.get("bowlTeamId") or "")

                if runs <= 0 and wickets <= 0:
                    continue

                if runs > 0:
                    output.append(
                        RawEvent(
                            sport=SportType.CRICKET,
                            match_id=live_id,
                            type="STAT",
                            payload={
                                "event_id": f"{live_id}:{player_id}:STAT:r{runs}:b{balls}",
                                "player_id": str(player_id),
                                "team_id": team_id,
                                "runs": runs,
                                "balls": balls,
                                "value": float(runs),
                                "raw": node,
                            },
                            timestamp=ts,
                        )
                    )

                if wickets > 0:
                    output.append(
                        RawEvent(
                            sport=SportType.CRICKET,
                            match_id=live_id,
                            type="WICKET",
                            payload={
                                "event_id": f"{live_id}:{player_id}:WICKET:w{wickets}",
                                "player_id": str(player_id),
                                "team_id": team_id,
                                "wickets": wickets,
                                "value": float(wickets),
                                "raw": node,
                            },
                            timestamp=ts,
                        )
                    )

        return output

    def normalize(self, raw: RawEvent) -> NormalizedEvent:
        event_type_map = {
            "WICKET": EventType.WICKET,
            "STAT": EventType.STAT,
            "SUB": EventType.SUB,
        }
        normalized_type = event_type_map.get(raw.type.upper(), EventType.STAT)

        return NormalizedEvent(
            sport=SportType.CRICKET,
            match_id=raw.match_id,
            event_type=normalized_type,
            player_id=str(raw.payload.get("player_id", "")),
            team_id=str(raw.payload.get("team_id", "")),
            value=float(raw.payload.get("value", 0.0)),
            meta=raw.payload,
            ts=raw.timestamp,
            event_id=str(raw.payload.get("event_id", f"{raw.match_id}:{raw.timestamp}")),
        )

from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod


class SportAdapter(ABC):
    sport: str

    @abstractmethod
    async def fetch_teams(self) -> list[dict[str, object]]:
        """Return canonical team payloads for the configured sport."""

    @abstractmethod
    async def fetch_players(self) -> list[dict[str, object]]:
        """Return canonical player payloads for the configured sport."""


class NBAAdapter(SportAdapter):
    sport = "nba"

    async def fetch_teams(self) -> list[dict[str, object]]:
        from nba_api.stats.static import teams as nba_teams

        raw_teams = await asyncio.to_thread(nba_teams.get_teams)
        teams: list[dict[str, object]] = []
        for team in raw_teams:
            teams.append(
                {
                    "external_id": str(team.get("id", "")),
                    "name": str(team.get("full_name", "")),
                    "abbreviation": team.get("abbreviation"),
                    "city": team.get("city"),
                    "conference": team.get("conference"),
                    "division": team.get("division"),
                }
            )
        return [team for team in teams if team["external_id"] and team["name"]]

    async def fetch_players(self) -> list[dict[str, object]]:
        from nba_api.stats.static import players as nba_players

        raw_players = await asyncio.to_thread(nba_players.get_players)
        players: list[dict[str, object]] = []
        for player in raw_players:
            players.append(
                {
                    "external_id": str(player.get("id", "")),
                    "full_name": str(player.get("full_name", "") or "").strip(),
                    "first_name": player.get("first_name"),
                    "last_name": player.get("last_name"),
                    "position": player.get("position") or None,
                    "team_external_id": str(player.get("team_id") or ""),
                    "is_active": bool(player.get("is_active", True)),
                }
            )
        return [player for player in players if player["external_id"] and player["full_name"]]


SPORT_ADAPTERS: dict[str, type[SportAdapter]] = {
    NBAAdapter.sport: NBAAdapter,
    "basketball": NBAAdapter,
}

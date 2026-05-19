from __future__ import annotations

from dataclasses import dataclass
import logging
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.ingestion.adapters import SPORT_ADAPTERS, SportAdapter
from app.ingestion.models import IngestionPlayer, IngestionTeam

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class IngestionResult:
    sport: str
    deleted_players: int = 0
    deleted_teams: int = 0
    inserted_teams: int = 0
    inserted_players: int = 0


class IngestionOrchestrator:
    def __init__(self, db: Session, adapter_registry: dict[str, type[SportAdapter]] | None = None) -> None:
        self.db = db
        self.adapter_registry = adapter_registry or SPORT_ADAPTERS

    def _get_adapter(self, sport: str) -> SportAdapter:
        adapter_cls = self.adapter_registry.get(sport.lower())
        if adapter_cls is None:
            raise ValueError(f"Unsupported sport '{sport}'")
        return adapter_cls()

    def clear_sport_data(self, sport: str) -> tuple[int, int]:
        sport_key = sport.lower()
        deleted_players = (
            self.db.query(IngestionPlayer)
            .filter(IngestionPlayer.sport == sport_key)
            .delete(synchronize_session=False)
        )
        deleted_teams = (
            self.db.query(IngestionTeam)
            .filter(IngestionTeam.sport == sport_key)
            .delete(synchronize_session=False)
        )
        logger.info(
            "Deleted %s players and %s teams for sport=%s",
            deleted_players,
            deleted_teams,
            sport_key,
        )
        return deleted_players, deleted_teams

    def _upsert_teams(self, sport: str, teams: Iterable[dict[str, object]]) -> int:
        sport_key = sport.lower()
        payloads = [
            {
                "sport": sport_key,
                "external_id": str(team["external_id"]),
                "name": str(team["name"]),
                "abbreviation": team.get("abbreviation"),
                "city": team.get("city"),
                "conference": team.get("conference"),
                "division": team.get("division"),
            }
            for team in teams
        ]
        if not payloads:
            return 0

        stmt = pg_insert(IngestionTeam).values(payloads)
        stmt = stmt.on_conflict_do_update(
            index_elements=[IngestionTeam.sport, IngestionTeam.external_id],
            set_={
                "name": stmt.excluded.name,
                "abbreviation": stmt.excluded.abbreviation,
                "city": stmt.excluded.city,
                "conference": stmt.excluded.conference,
                "division": stmt.excluded.division,
            },
        )
        self.db.execute(stmt)
        logger.info("Inserted %s teams for sport=%s", len(payloads), sport_key)
        return len(payloads)

    def _team_id_by_external_id(self, sport: str) -> dict[str, object]:
        sport_key = sport.lower()
        rows = self.db.execute(
            select(IngestionTeam.id, IngestionTeam.external_id).where(IngestionTeam.sport == sport_key)
        ).all()
        return {str(external_id): team_id for team_id, external_id in rows}

    def _upsert_players(self, sport: str, players: Iterable[dict[str, object]], team_id_map: dict[str, object]) -> int:
        sport_key = sport.lower()
        payloads = []
        skipped = 0
        for player in players:
            team_external_id = str(player.get("team_external_id") or "")
            team_id = team_id_map.get(team_external_id)
            if team_id is None:
                skipped += 1
                continue
            payloads.append(
                {
                    "sport": sport_key,
                    "external_id": str(player["external_id"]),
                    "full_name": str(player["full_name"]),
                    "first_name": player.get("first_name"),
                    "last_name": player.get("last_name"),
                    "position": player.get("position"),
                    "team_id": team_id,
                    "is_active": bool(player.get("is_active", True)),
                }
            )

        if not payloads:
            logger.info("No players to insert for sport=%s (skipped=%s)", sport_key, skipped)
            return 0

        stmt = pg_insert(IngestionPlayer).values(payloads)
        stmt = stmt.on_conflict_do_update(
            index_elements=[IngestionPlayer.sport, IngestionPlayer.external_id],
            set_={
                "full_name": stmt.excluded.full_name,
                "first_name": stmt.excluded.first_name,
                "last_name": stmt.excluded.last_name,
                "position": stmt.excluded.position,
                "team_id": stmt.excluded.team_id,
                "is_active": stmt.excluded.is_active,
            },
        )
        self.db.execute(stmt)
        logger.info(
            "Inserted %s players for sport=%s (skipped=%s)",
            len(payloads),
            sport_key,
            skipped,
        )
        return len(payloads)

    async def ingest(self, sport: str) -> IngestionResult:
        adapter = self._get_adapter(sport)
        result = IngestionResult(sport=sport.lower())

        try:
            result.deleted_players, result.deleted_teams = self.clear_sport_data(sport)

            teams = await adapter.fetch_teams()
            result.inserted_teams = self._upsert_teams(sport, teams)

            team_id_map = self._team_id_by_external_id(sport)

            players = await adapter.fetch_players()
            result.inserted_players = self._upsert_players(sport, players, team_id_map)

            self.db.commit()
            logger.info("Completed ingestion for sport=%s: %s", result.sport, result)
            return result
        except Exception:
            self.db.rollback()
            logger.exception("Ingestion failed for sport=%s", sport)
            raise

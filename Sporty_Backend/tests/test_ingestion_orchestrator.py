from __future__ import annotations

from dataclasses import dataclass
import asyncio

from app.ingestion.adapters import NBAAdapter
from app.ingestion.orchestrator import IngestionOrchestrator


def test_nba_adapter_normalizes_static_payloads(monkeypatch):
    monkeypatch.setattr(
        "nba_api.stats.static.teams.get_teams",
        lambda: [
            {
                "id": 1,
                "full_name": "Boston Celtics",
                "abbreviation": "BOS",
                "city": "Boston",
                "conference": "East",
                "division": "Atlantic",
            }
        ],
    )
    monkeypatch.setattr(
        "nba_api.stats.static.players.get_players",
        lambda: [
            {
                "id": 23,
                "full_name": "Jayson Tatum",
                "first_name": "Jayson",
                "last_name": "Tatum",
                "position": "F",
                "team_id": 1,
                "is_active": True,
            }
        ],
    )

    adapter = NBAAdapter()

    async def _run() -> None:
        teams = await adapter.fetch_teams()
        players = await adapter.fetch_players()

        assert teams == [
            {
                "external_id": "1",
                "name": "Boston Celtics",
                "abbreviation": "BOS",
                "city": "Boston",
                "conference": "East",
                "division": "Atlantic",
            }
        ]
        assert players == [
            {
                "external_id": "23",
                "full_name": "Jayson Tatum",
                "first_name": "Jayson",
                "last_name": "Tatum",
                "position": "F",
                "team_external_id": "1",
                "is_active": True,
            }
        ]

    asyncio.run(_run())


class _QueryStub:
    def __init__(self, session, model):
        self.session = session
        self.model = model
        self._filters = []

    def filter(self, *criteria):
        self._filters.extend(criteria)
        return self

    def delete(self, synchronize_session=False):
        _ = synchronize_session
        self.session.deletes.append((self.model, list(self._filters)))
        return self.session.deleted_counts.get(self.model.__name__, 0)


class _SessionStub:
    def __init__(self):
        self.deletes = []
        self.executed = []
        self.deleted_counts = {"IngestionPlayer": 12, "IngestionTeam": 3}
        self.team_rows = [("team-a", "1")]
        self.commits = 0
        self.rollbacks = 0

    def query(self, model):
        return _QueryStub(self, model)

    def execute(self, statement):
        self.executed.append(statement)

        @dataclass
        class _Result:
            rows: list[tuple[str, str]]

            def all(self):
                return self.rows

        return _Result(self.team_rows)

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


class _AdapterStub:
    sport = "nba"

    async def fetch_teams(self):
        return [
            {
                "external_id": "1",
                "name": "Boston Celtics",
                "abbreviation": "BOS",
                "city": "Boston",
                "conference": "East",
                "division": "Atlantic",
            }
        ]

    async def fetch_players(self):
        return [
            {
                "external_id": "23",
                "full_name": "Jayson Tatum",
                "first_name": "Jayson",
                "last_name": "Tatum",
                "position": "F",
                "team_external_id": "1",
                "is_active": True,
            }
        ]


def test_orchestrator_clears_then_ingests_in_order(monkeypatch):
    session = _SessionStub()
    orchestrator = IngestionOrchestrator(session, adapter_registry={"nba": _AdapterStub})

    monkeypatch.setattr(orchestrator, "_team_id_by_external_id", lambda sport: {"1": "team-uuid"})

    async def _run():
        result = await orchestrator.ingest("nba")

        assert result.deleted_players == 12
        assert result.deleted_teams == 3
        assert result.inserted_teams == 1
        assert result.inserted_players == 1
        assert session.commits == 1
        assert session.rollbacks == 0
        assert [entry[0].__name__ for entry in session.deletes] == ["IngestionPlayer", "IngestionTeam"]

    asyncio.run(_run())

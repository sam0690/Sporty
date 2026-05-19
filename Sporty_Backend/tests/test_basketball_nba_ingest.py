from __future__ import annotations

import asyncio
import uuid
from types import SimpleNamespace

from app.auth.models import RefreshToken, User  # noqa: F401
from app.league.models import Sport
from app.player.models_nba import NBAStat  # noqa: F401
from app.player.models import Player, RealTeam
from app.services.sync.basketball_sync import sync_basketball_players


class _QueryStub:
    def __init__(self, session, model):
        self.session = session
        self.model = model

    def filter(self, *criteria):
        _ = criteria
        return self

    def first(self):
        if self.model is Sport:
            return self.session.sport
        return None

    def delete(self, synchronize_session=False):
        _ = synchronize_session
        if self.model is Player:
            deleted = self.session.deleted_players
            self.session.deleted_players = 0
            return deleted
        if self.model is RealTeam:
            deleted = self.session.deleted_teams
            self.session.deleted_teams = 0
            return deleted
        return 0


class _SessionStub:
    def __init__(self):
        self.sport = SimpleNamespace(id="sport-basketball", name="basketball")
        self.deleted_players = 7
        self.deleted_teams = 3
        self.added = []
        self.commits = 0
        self.rollbacks = 0

    def query(self, model):
        return _QueryStub(self, model)

    def add(self, obj):
        if isinstance(obj, RealTeam) and obj.id is None:
            obj.id = uuid.uuid4()
        self.added.append(obj)

    def flush(self):
        return None

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


class _FakeRosterFrame:
    def __init__(self, rows):
        self._rows = rows

    def to_dict(self, orient):
        assert orient == "records"
        return self._rows


class _FakeRosterEndpoint:
    def __init__(self, team_id, season):
        self.team_id = team_id
        self.season = season

    def get_data_frames(self):
        return [
            _FakeRosterFrame(
                [
                    {"PLAYER_ID": 1001, "PLAYER": "Jane Doe", "POSITION": "G"},
                ]
            )
        ]


def test_basketball_sync_clears_and_reingests_nba_catalog(monkeypatch):
    session = _SessionStub()

    monkeypatch.setattr(
        "nba_api.stats.static.teams.get_teams",
        lambda: [
            {
                "id": 1610612747,
                "full_name": "Los Angeles Lakers",
                "abbreviation": "LAL",
                "nickname": "Lakers",
                "city": "Los Angeles",
                "state": "California",
                "year_founded": 1948,
            }
        ],
    )
    monkeypatch.setattr(
        "nba_api.stats.endpoints.commonteamroster.CommonTeamRoster",
        _FakeRosterEndpoint,
    )

    async def _run():
        await sync_basketball_players(session, season="2025-26")

    asyncio.run(_run())

    assert session.deleted_players == 0
    assert session.deleted_teams == 0
    assert session.commits == 1
    assert session.rollbacks == 0
    assert len(session.added) == 2

    team = next(obj for obj in session.added if isinstance(obj, RealTeam))
    player = next(obj for obj in session.added if isinstance(obj, Player))

    assert team.name == "Los Angeles Lakers"
    assert team.external_api_id == "1610612747"
    assert player.name == "Jane Doe"
    assert player.external_api_id == "1001"
    assert player.real_team == "Los Angeles Lakers"
    assert player.real_team_id is not None

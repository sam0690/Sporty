from __future__ import annotations

import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient

_temp_db_url = "postgresql+psycopg2://user:pass@localhost/test"
os.environ["DATABASE_URL"] = _temp_db_url
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["JWT_SECRET_KEY"] = "x" * 32
os.environ["GOOGLE_CLIENT_ID"] = "test-client"

_backend_root = Path(__file__).resolve().parents[1]
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from app.auth.dependencies import get_current_active_user
import app.auth.models  # noqa: F401
import app.match.models  # noqa: F401
import app.league.models  # noqa: F401
import app.player.models  # noqa: F401
import app.player.models_nba  # noqa: F401
from app.player import router as player_router
from app.player import services as player_service


def _build_app(user: SimpleNamespace) -> FastAPI:
    app = FastAPI()
    app.include_router(player_router.router, prefix="/api")

    def _override_current_user():
        return user

    app.dependency_overrides[get_current_active_user] = _override_current_user
    return app


def _make_user() -> SimpleNamespace:
    return SimpleNamespace(
        id=uuid.uuid4(),
        username="owner",
        email="owner@example.com",
        is_active=True,
        is_verified=True,
    )


def _make_stat(player_id: uuid.UUID, name: str, points: str):
    return SimpleNamespace(
        player=SimpleNamespace(
            id=player_id,
            name=name,
            position="MID",
            real_team="Club",
            cost=8.5,
            sport=SimpleNamespace(name="football", display_name="Football"),
        ),
        transfer_window=SimpleNamespace(
            id=uuid.uuid4(),
            number=1,
            start_at=datetime.now(timezone.utc),
            end_at=datetime.now(timezone.utc),
        ),
        minutes_played=90,
        fantasy_points=points,
        football_stat=SimpleNamespace(
            goals=1,
            assists=0,
            clean_sheets=1,
            yellow_cards=0,
            red_cards=0,
            own_goals=0,
            penalties_saved=0,
            penalties_missed=0,
            saves=0,
            goals_conceded=0,
            bonus=3,
        ),
        cricket_stat=None,
    )


def test_bulk_player_stats_endpoint_returns_all_stats_for_requested_sport(monkeypatch) -> None:
    user = _make_user()
    app = _build_app(user)

    requested: dict[str, object] = {}

    def _fake_bulk_stats(db, gameweek_id, sport):
        requested["db"] = db
        requested["gameweek_id"] = gameweek_id
        requested["sport"] = sport
        return [
            _make_stat(uuid.uuid4(), "Football 1", "6.5"),
            _make_stat(uuid.uuid4(), "Football 2", "8.0"),
        ]

    monkeypatch.setattr(player_service, "get_player_stats_for_gameweek", _fake_bulk_stats)

    client = TestClient(app)
    gameweek_id = uuid.uuid4()
    response = client.get(
        "/api/players/stats",
        params={"gameweek_id": str(gameweek_id), "sport": "football"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 2
    assert {item["player"]["name"] for item in payload} == {"Football 1", "Football 2"}
    assert all(item["football_stat"] is not None for item in payload)
    assert all(item["cricket_stat"] is None for item in payload)
    assert requested["gameweek_id"] == gameweek_id
    assert requested["sport"] == "football"
    assert requested["db"] is not None

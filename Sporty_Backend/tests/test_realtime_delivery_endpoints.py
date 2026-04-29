from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api import deps
from app.api.routes import match as match_routes
from app.api.routes import sse as sse_routes
from app.api.routes import websocket as websocket_routes


class _FakeResult:
    def __init__(self, *, row=None, scalar=None):
        self._row = row
        self._scalar = scalar

    def mappings(self):
        return self

    def first(self):
        return self._row

    def scalar_one_or_none(self):
        return self._scalar


class _FakeAsyncDB:
    async def execute(self, stmt, params=None):
        sql = str(stmt)
        if "FROM matches" in sql:
            return _FakeResult(
                row={
                    "id": "match-1",
                    "home_team": "A",
                    "away_team": "B",
                    "home_score": 2,
                    "away_score": 1,
                    "status": "live",
                    "match_date": datetime(2026, 4, 12, tzinfo=timezone.utc),
                }
            )
        return _FakeResult(scalar=1)


class _FakePubSub:
    def __init__(self, payload: str):
        self.payload = payload

    async def subscribe(self, channel: str):
        _ = channel

    async def unsubscribe(self, channel: str):
        _ = channel

    async def close(self):
        return None

    async def listen(self):
        yield {"type": "message", "data": self.payload}


class _FakeRedis:
    def __init__(self):
        self._points = {
            "fantasy:match:ext-101:player:p1": "12.5",
            "fantasy:match:ext-101:player:p2": "7.0",
        }

    async def keys(self, pattern: str):
        return [k for k in self._points if k.startswith(pattern.replace("*", ""))]

    async def hget(self, key: str, field: str):
        _ = field
        return self._points.get(key)

    def pubsub(self):
        return _FakePubSub('{"event":"MATCH_EVENT","data":{"kind":"LEADERBOARD_DELTA"}}')


class _FakeManager:
    async def connect(self, ws, channel: str):
        _ = channel
        await ws.accept()
        await ws.send_text('{"event":"MATCH_EVENT","data":{"kind":"CONNECTED"}}')

    async def disconnect(self, ws, channel: str):
        _ = (ws, channel)


def _build_app() -> FastAPI:
    app = FastAPI()
    app.include_router(match_routes.router, prefix="/api")
    app.include_router(sse_routes.router, prefix="/api")
    app.include_router(websocket_routes.router, prefix="/api")

    async def _fake_current_user_async():
        return type("User", (), {"id": uuid.uuid4(), "is_active": True})()

    async def _fake_current_user_ws():
        return type("User", (), {"id": uuid.uuid4(), "is_active": True})()

    async def _fake_db_dep():
        yield _FakeAsyncDB()

    async def _fake_redis_dep():
        return _FakeRedis()

    async def _fake_match_access():
        return type("Match", (), {"id": "match-1", "external_api_id": "ext-101"})()

    async def _fake_manager_dep():
        return _FakeManager()

    app.dependency_overrides[deps.get_current_active_user_async] = _fake_current_user_async
    app.dependency_overrides[deps.get_current_active_user_ws] = _fake_current_user_ws
    app.dependency_overrides[deps.get_async_db] = _fake_db_dep
    app.dependency_overrides[deps.get_async_redis_dep] = _fake_redis_dep
    app.dependency_overrides[deps.require_match_access] = _fake_match_access
    app.dependency_overrides[deps.require_match_access_ws] = _fake_match_access
    app.dependency_overrides[deps.get_connection_manager] = _fake_manager_dep

    return app


def test_match_state_hydration_endpoint_returns_snapshot():
    app = _build_app()
    client = TestClient(app)

    response = client.get("/api/match/match-1/state")

    assert response.status_code == 200
    payload = response.json()
    assert payload["match_id"] == "match-1"
    assert payload["score"] == {"home": 2, "away": 1}
    assert payload["player_points"]["p1"] == 12.5


def test_websocket_match_stream_connects_and_receives_message():
    app = _build_app()
    client = TestClient(app)

    with client.websocket_connect("/api/ws/match/match-1") as ws:
        msg = ws.receive_json()
        assert msg["event"] == "MATCH_EVENT"


def test_sse_leaderboard_stream_yields_events():
    app = _build_app()
    client = TestClient(app)

    with client.stream("GET", "/api/match/match-1/leaderboard/stream") as response:
        body = b"".join(response.iter_bytes())

    assert response.status_code == 200
    assert b"LEADERBOARD_DELTA" in body

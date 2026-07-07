from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.dialects import postgresql

import app.api.v1.feed as feed_module

# Register all model modules so SQLAlchemy can resolve relationship names
# (same convention as app/main.py) before any ORM instance is constructed.
from app.auth.models import User  # noqa: F401
from app.ingestion.models import IngestionPlayer  # noqa: F401
from app.league.models import League  # noqa: F401
from app.notification.models import Notification  # noqa: F401
from app.player.models import Player, RealTeam  # noqa: F401
from app.player.models_nba import NBAStat  # noqa: F401
from app.scoring.models import DefaultScoringRule  # noqa: F401

from app.api.v1.feed import router as feed_router
from app.core.config import settings
from app.core.redis import get_async_redis
from app.database import get_db

SECRET = "test-feeder-secret"
MATCH_UUID = uuid.UUID("aaaaaaaa-0000-0000-0000-000000000001")


class _FakeQuery:
    def __init__(self, match):
        self._match = match

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self._match


class _FakeDB:
    def __init__(self, match=None, sport=None):
        self.match = match
        self.sport = sport
        self.statements = []
        self.commits = 0
        self.rollbacks = 0
        self.added = []

    def query(self, model):
        from app.league.models import Sport

        if model is Sport:
            return _FakeQuery(self.sport)
        return _FakeQuery(self.match)

    def execute(self, statement, params=None):
        self.statements.append(statement)
        if params is not None or not hasattr(statement, "_multi_values"):
            # Textual queries (e.g. the player-name resolution SELECT): no rows
            # in the fake — events simply render without resolved names.
            return SimpleNamespace(mappings=lambda: SimpleNamespace(all=lambda: []))
        rowcount = len(statement.compile(dialect=postgresql.dialect()).params) and sum(
            1 for _ in statement._multi_values[0]
        )
        return SimpleNamespace(rowcount=rowcount)

    def add(self, obj):
        self.added.append(obj)

    def refresh(self, obj):
        if getattr(obj, "id", None) is None:
            obj.id = uuid.uuid4()

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


class _FakeRedis:
    def __init__(self):
        self.published: list[tuple[str, str]] = []
        self.setex_calls: list[tuple[str, int, str]] = []
        self.storage: dict[str, str] = {}

    async def publish(self, channel, message):
        self.published.append((channel, message))

    async def setex(self, key, ttl, value):
        self.setex_calls.append((key, ttl, value))
        self.storage[key] = value

    async def get(self, key):
        return self.storage.get(key)


def make_match(status="live"):
    return SimpleNamespace(
        id=MATCH_UUID,
        external_api_id="ext-feeder-1",
        status=status,
        home_score=None,
        away_score=None,
        match_date=datetime(2026, 6, 10, 18, 0, tzinfo=timezone.utc),
        sport_id=uuid.uuid4(),
    )


@pytest.fixture
def harness(monkeypatch):
    monkeypatch.setattr(settings, "FEEDER_SECRET", SECRET)
    scoring_calls = []
    monkeypatch.setattr(
        feed_module,
        "_enqueue_scoring",
        lambda db, *, match_date, sport_id: scoring_calls.append((match_date, sport_id)) or 1,
    )

    # The fantasy-scoring side effects (live per-player deltas + folding events
    # into gameweek stats) have their own coverage and hit Redis/ORM details the
    # fakes here don't model; stub them so these tests stay focused on the
    # endpoint's orchestration (score update, publish, idempotency, scoring trigger).
    async def _noop_live_points(*args, **kwargs):
        return {}

    monkeypatch.setattr(feed_module, "apply_live_points", _noop_live_points)
    monkeypatch.setattr(
        feed_module,
        "persist_match_stats",
        lambda db, *, match, live_key, sport: {"players": 0, "windows": 0, "stat_rows": 0},
    )

    fake_db = _FakeDB(match=make_match())
    fake_redis = _FakeRedis()

    app = FastAPI()
    app.include_router(feed_router, prefix="/api/v1")
    app.dependency_overrides[get_db] = lambda: fake_db
    app.dependency_overrides[get_async_redis] = lambda: fake_redis

    client = TestClient(app)
    return SimpleNamespace(client=client, db=fake_db, redis=fake_redis, scoring_calls=scoring_calls)


def match_result_payload(status="live", events=None):
    return {
        "sporty_match_id": str(MATCH_UUID),
        "sport": "football",
        "status": status,
        "home_score": 2,
        "away_score": 1,
        "current_minute": 67,
        "events": events
        if events is not None
        else [
            {
                "event_id": "11111111-1111-1111-1111-111111111111",
                "event_type": "goal",
                "sporty_player_id": "p-uuid-1",
                "sporty_team_id": "t-uuid-1",
                "minute": 67,
            },
            {
                "event_id": "22222222-2222-2222-2222-222222222222",
                "event_type": "assist",
                "sporty_player_id": "p-uuid-2",
                "sporty_team_id": "t-uuid-1",
                "minute": 67,
            },
        ],
    }


class TestFeederSecret:
    def test_missing_header_is_401(self, harness):
        response = harness.client.post("/api/v1/feed/match-result", json=match_result_payload())
        assert response.status_code == 401

    def test_wrong_secret_is_401(self, harness):
        response = harness.client.post(
            "/api/v1/feed/match-result",
            json=match_result_payload(),
            headers={"X-Feeder-Secret": "wrong"},
        )
        assert response.status_code == 401

    def test_unconfigured_secret_is_503(self, harness, monkeypatch):
        monkeypatch.setattr(settings, "FEEDER_SECRET", "")
        response = harness.client.post(
            "/api/v1/feed/match-result",
            json=match_result_payload(),
            headers={"X-Feeder-Secret": SECRET},
        )
        assert response.status_code == 503

    def test_secret_is_never_logged(self, harness, caplog):
        with caplog.at_level(logging.DEBUG):
            harness.client.post(
                "/api/v1/feed/match-result",
                json=match_result_payload(),
                headers={"X-Feeder-Secret": "super-secret-value"},
            )
        assert "super-secret-value" not in caplog.text
        assert SECRET not in caplog.text


class TestMatchResult:
    def headers(self):
        return {"X-Feeder-Secret": SECRET}

    def test_updates_score_and_publishes(self, harness):
        response = harness.client.post(
            "/api/v1/feed/match-result", json=match_result_payload(), headers=self.headers()
        )
        assert response.status_code == 200
        body = response.json()
        assert body["events_received"] == 2
        assert body["events_inserted"] == 2

        assert harness.db.match.home_score == 2
        assert harness.db.match.away_score == 1
        assert harness.db.match.status == "live"
        assert harness.db.commits == 1

        channel, message = harness.redis.published[0]
        assert channel == f"{settings.REDIS_PUBSUB_PREFIX}:ext-feeder-1"
        data = json.loads(message)
        assert data["event"] == "SCORE_UPDATE"
        # Canonical ScoreUpdate keys — the frontend matchStore reads home/away/minute.
        assert data["data"]["home"] == 2
        assert data["data"]["away"] == 1
        assert data["data"]["minute"] == 67
        assert data["data"]["kind"] == "FEED_MATCH_RESULT"
        assert len(data["data"]["events"]) == 2

    def test_favourite_notification_failure_does_not_break_ingest(self, harness, monkeypatch):
        # notify_favourite_event is called for "goal" events (the default
        # payload has one) once the event's player/team resolve to real ids.
        # A hard failure there (bad email config, DB hiccup, etc.) must never
        # fail the feeder's request or block scoring — it's wrapped in its
        # own try/except with a rollback, isolated from everything else in
        # this handler. The generic fake DB resolves raw-SQL lookups to no
        # rows (see _FakeDB.execute), so make the player/real_team resolution
        # queries specifically return a match — otherwise the notify call
        # this test targets is never reached at all.
        real_execute = harness.db.execute

        def _execute_with_resolution(statement, params=None):
            sql = str(statement)
            if params and "FROM players" in sql:
                return SimpleNamespace(
                    mappings=lambda: SimpleNamespace(
                        all=lambda: [
                            {
                                "id": str(uuid.uuid4()),
                                "external_api_id": "p-uuid-1",
                                "name": "Test Player",
                                "real_team": "Test FC",
                            }
                        ]
                    )
                )
            if params and "FROM real_teams" in sql:
                return SimpleNamespace(
                    mappings=lambda: SimpleNamespace(
                        all=lambda: [{"id": str(uuid.uuid4()), "external_api_id": "t-uuid-1"}]
                    )
                )
            return real_execute(statement, params)

        monkeypatch.setattr(harness.db, "execute", _execute_with_resolution)

        def _boom(*args, **kwargs):
            raise RuntimeError("simulated notification fanout failure")

        monkeypatch.setattr(
            feed_module.notification_service, "notify_favourite_event", _boom
        )

        response = harness.client.post(
            "/api/v1/feed/match-result", json=match_result_payload(), headers=self.headers()
        )

        assert response.status_code == 200
        body = response.json()
        assert body["events_received"] == 2
        assert body["events_inserted"] == 2
        assert harness.db.match.home_score == 2
        assert harness.db.rollbacks == 1

    def test_event_upsert_is_idempotent_on_event_id(self, harness):
        harness.client.post("/api/v1/feed/match-result", json=match_result_payload(), headers=self.headers())
        statement = harness.db.statements[0]
        sql = str(statement.compile(dialect=postgresql.dialect()))
        assert "INSERT INTO live_events" in sql
        assert "ON CONFLICT (match_id, event_id) DO NOTHING" in sql

    def test_finished_triggers_scoring(self, harness):
        response = harness.client.post(
            "/api/v1/feed/match-result",
            json=match_result_payload(status="finished", events=[]),
            headers=self.headers(),
        )
        assert response.json()["scoring_enqueued"] == 1
        assert len(harness.scoring_calls) == 1
        match_date, sport_id = harness.scoring_calls[0]
        assert match_date == harness.db.match.match_date
        assert sport_id == harness.db.match.sport_id

        # A replayed finished push re-runs booking/scoring too: persist_match_stats
        # is idempotent per match (assigns full recomputed counts, doesn't
        # accumulate), so this is safe and is what lets a late events batch that
        # lands *after* the first finished push still get counted instead of
        # silently dropped.
        again = harness.client.post(
            "/api/v1/feed/match-result",
            json=match_result_payload(status="finished", events=[]),
            headers=self.headers(),
        )
        assert again.json()["scoring_enqueued"] == 1
        assert len(harness.scoring_calls) == 2

    def test_live_status_does_not_trigger_scoring(self, harness):
        harness.client.post("/api/v1/feed/match-result", json=match_result_payload(), headers=self.headers())
        assert harness.scoring_calls == []

    def test_unknown_match_is_404(self, harness):
        harness.db.match = None
        response = harness.client.post(
            "/api/v1/feed/match-result", json=match_result_payload(), headers=self.headers()
        )
        assert response.status_code == 404


class TestPrediction:
    def test_prediction_is_cached_24h(self, harness):
        payload = {
            "sporty_match_id": str(MATCH_UUID),
            "home_win_prob": 0.62,
            "draw_prob": 0.21,
            "away_win_prob": 0.17,
            "model_version": "outcome_v1_logistic",
        }
        response = harness.client.post(
            "/api/v1/feed/prediction", json=payload, headers={"X-Feeder-Secret": SECRET}
        )
        assert response.status_code == 200

        key, ttl, value = harness.redis.setex_calls[0]
        assert key == f"prediction:match:{MATCH_UUID}"
        assert ttl == 86400
        assert json.loads(value)["home_win_prob"] == 0.62


class TestSubstitutionLineupChange:
    def test_substitution_publishes_lineup_change(self, harness):
        payload = match_result_payload(events=[
            {
                "event_id": "33333333-3333-3333-3333-333333333333",
                "event_type": "substitution",
                "sporty_player_id": "p-uuid-on",
                "sporty_team_id": "t-uuid-1",
                "minute": 62,
                "related_sporty_player_id": "p-uuid-off",
            },
        ])
        response = harness.client.post(
            "/api/v1/feed/match-result", json=payload,
            headers={"X-Feeder-Secret": SECRET},
        )
        assert response.status_code == 200

        messages = [json.loads(m) for _, m in harness.redis.published]
        lineup = [m for m in messages if m["event"] == "LINEUP_CHANGE"]
        assert len(lineup) == 1
        data = lineup[0]["data"]
        assert data["player_in"] == "p-uuid-on"
        assert data["player_out"] == "p-uuid-off"
        assert data["team_id"] == "t-uuid-1"
        assert data["minute"] == 62

    def test_non_substitution_events_do_not_publish_lineup_change(self, harness):
        response = harness.client.post(
            "/api/v1/feed/match-result", json=match_result_payload(),
            headers={"X-Feeder-Secret": SECRET},
        )
        assert response.status_code == 200
        messages = [json.loads(m) for _, m in harness.redis.published]
        assert not [m for m in messages if m["event"] == "LINEUP_CHANGE"]


class TestModelMetrics:
    def test_model_metrics_are_cached_globally(self, harness):
        payload = {
            "generated_at": "2026-07-03T12:00:00+00:00",
            "finished_matches_scored": 8,
            "predictions_scored": 8,
            "by_model_version": {
                "outcome_v4_elo_sot": {
                    "n": 8,
                    "accuracy": 0.625,
                    "log_loss": 0.9013,
                    "brier": 0.5495,
                    "ece": 0.4508,
                    "calibration": [
                        {"bin": "0.6-0.7", "n": 4, "avg_confidence": 0.657, "accuracy": 1.0}
                    ],
                }
            },
        }
        response = harness.client.post(
            "/api/v1/feed/model-metrics", json=payload, headers={"X-Feeder-Secret": SECRET}
        )
        assert response.status_code == 200
        assert response.json()["model_versions"] == ["outcome_v4_elo_sot"]

        key, ttl, value = harness.redis.setex_calls[0]
        assert key == "model:metrics"
        assert ttl == 7 * 86400
        cached = json.loads(value)
        assert cached["by_model_version"]["outcome_v4_elo_sot"]["accuracy"] == 0.625

    def test_model_metrics_require_secret(self, harness):
        response = harness.client.post(
            "/api/v1/feed/model-metrics",
            json={"generated_at": "x", "finished_matches_scored": 0,
                  "predictions_scored": 0, "by_model_version": {}},
            headers={"X-Feeder-Secret": "wrong"},
        )
        assert response.status_code == 401


class TestPlayerRatings:
    def test_ratings_are_cached_24h_and_motm_logged(self, harness, caplog):
        payload = {
            "sporty_match_id": str(MATCH_UUID),
            "sport": "football",
            "man_of_match_sporty_player_id": "p-uuid-1",
            "ratings": [
                {
                    "sporty_player_id": "p-uuid-1",
                    "rating": 8.4,
                    "goals": 2,
                    "assists": 1,
                    "minutes_played": 90,
                    "events": ["goal", "goal", "assist"],
                }
            ],
        }
        with caplog.at_level(logging.INFO):
            response = harness.client.post(
                "/api/v1/feed/player-ratings", json=payload, headers={"X-Feeder-Secret": SECRET}
            )
        assert response.status_code == 200
        assert response.json()["ratings_received"] == 1

        key, ttl, value = harness.redis.setex_calls[0]
        assert key == f"ratings:match:{MATCH_UUID}"
        assert ttl == 86400
        assert json.loads(value)["ratings"][0]["rating"] == 8.4
        assert "man of the match: p-uuid-1" in caplog.text


class TestScheduleMatch:
    def payload(self, **overrides):
        base = {
            "sport": "football",
            "home_team": "Strong FC",
            "away_team": "Weak FC",
            "match_date": "2026-06-12T18:00:00Z",
        }
        base.update(overrides)
        return base

    def test_creates_match_and_returns_uuid(self, harness):
        harness.db.match = None  # no existing match with this external_ref
        harness.db.sport = SimpleNamespace(id=uuid.uuid4(), name="football")
        response = harness.client.post(
            "/api/v1/feed/schedule-match", json=self.payload(), headers={"X-Feeder-Secret": SECRET}
        )
        assert response.status_code == 200
        body = response.json()
        assert body["created"] is True
        assert uuid.UUID(body["sporty_match_id"])  # parseable UUID
        assert body["external_ref"].startswith("feeder:")
        assert len(harness.db.added) == 1
        assert harness.db.added[0].status == "scheduled"

    def test_same_external_ref_is_idempotent(self, harness):
        harness.db.sport = SimpleNamespace(id=uuid.uuid4(), name="football")
        existing = make_match(status="scheduled")
        harness.db.match = existing
        response = harness.client.post(
            "/api/v1/feed/schedule-match",
            json=self.payload(external_ref="feeder:fixed-ref"),
            headers={"X-Feeder-Secret": SECRET},
        )
        body = response.json()
        assert body["created"] is False
        assert body["sporty_match_id"] == str(existing.id)
        assert harness.db.added == []

    def test_unknown_sport_is_422(self, harness):
        harness.db.sport = None
        harness.db.match = None
        response = harness.client.post(
            "/api/v1/feed/schedule-match",
            json=self.payload(sport="quidditch"),
            headers={"X-Feeder-Secret": SECRET},
        )
        assert response.status_code == 422

    def test_requires_secret(self, harness):
        assert (
            harness.client.post("/api/v1/feed/schedule-match", json=self.payload()).status_code == 401
        )


class _FakeAsyncResult:
    def mappings(self):
        return self

    def all(self):
        return []

    def first(self):
        return None


class _FakeAsyncDB:
    """No real rows for either the player-name-resolution SELECT or the
    match_feed_cache Postgres-fallback SELECT — these read tests only need to
    verify the Redis-cache path (and the 404-when-nothing-cached path), not
    the durable-backstop query itself."""

    async def execute(self, statement, params=None):
        return _FakeAsyncResult()


class TestFeedReadEndpoints:
    """GET /api/match/{id}/prediction and /ratings — the REST surface the
    frontend uses to read what the feeder pushed."""

    @pytest.fixture
    def read_harness(self, harness):
        from app.api import deps
        from app.api.routes.match import router as realtime_match_router

        match = make_match()
        read_app = FastAPI()
        read_app.include_router(realtime_match_router, prefix="/api")
        read_app.dependency_overrides[deps.require_match_access] = lambda: match
        read_app.dependency_overrides[deps.get_async_redis_dep] = lambda: harness.redis
        read_app.dependency_overrides[deps.get_async_db] = lambda: _FakeAsyncDB()
        return SimpleNamespace(client=TestClient(read_app), redis=harness.redis, match=match)

    def test_prediction_roundtrip_from_feed_push(self, harness, read_harness):
        prediction = {
            "sporty_match_id": str(MATCH_UUID),
            "home_win_prob": 0.62,
            "draw_prob": 0.21,
            "away_win_prob": 0.17,
            "model_version": "outcome_v1_logistic",
        }
        # sporty_match_id here equals the match UUID, so the cache key uses it.
        harness.client.post(
            "/api/v1/feed/prediction", json=prediction, headers={"X-Feeder-Secret": SECRET}
        )
        response = read_harness.client.get(f"/api/match/{MATCH_UUID}/prediction")
        assert response.status_code == 200
        assert response.json()["home_win_prob"] == 0.62

    def test_ratings_roundtrip_from_feed_push(self, harness, read_harness):
        ratings = {
            "sporty_match_id": str(MATCH_UUID),
            "sport": "football",
            "man_of_match_sporty_player_id": "p1",
            "ratings": [{"sporty_player_id": "p1", "rating": 8.4}],
        }
        harness.client.post(
            "/api/v1/feed/player-ratings", json=ratings, headers={"X-Feeder-Secret": SECRET}
        )
        response = read_harness.client.get(f"/api/match/{MATCH_UUID}/ratings")
        assert response.status_code == 200
        assert response.json()["man_of_match_sporty_player_id"] == "p1"

    def test_prediction_falls_back_to_external_api_id_key(self, harness, read_harness):
        # Feeder linked the match by external id rather than UUID.
        harness.redis.storage["prediction:match:ext-feeder-1"] = json.dumps({"home_win_prob": 0.5})
        response = read_harness.client.get(f"/api/match/{MATCH_UUID}/prediction")
        assert response.status_code == 200

    def test_missing_caches_are_404(self, read_harness):
        assert read_harness.client.get(f"/api/match/{MATCH_UUID}/prediction").status_code == 404
        assert read_harness.client.get(f"/api/match/{MATCH_UUID}/ratings").status_code == 404

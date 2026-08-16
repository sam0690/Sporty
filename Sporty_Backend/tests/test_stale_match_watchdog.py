from __future__ import annotations

import sys
import types
import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

# Register model modules so SQLAlchemy resolves relationships (same convention
# as app/main.py) before feed_scoring's Match/Sport queries are constructed.
from app.auth.models import User  # noqa: F401
from app.ingestion.models import IngestionPlayer  # noqa: F401
from app.league.models import League, Sport  # noqa: F401
from app.notification.models import Notification  # noqa: F401
from app.player.models import Player, RealTeam  # noqa: F401
from app.player.models_nba import NBAStat  # noqa: F401
from app.scoring.models import DefaultScoringRule  # noqa: F401

import app.services.feed_scoring as fs


class _FakeQuery:
    def __init__(self, result):
        self._result = result

    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return self._result

    def all(self):
        return self._result if isinstance(self._result, list) else [self._result]


class _FakeDB:
    def __init__(self, matches, sport):
        self.matches = matches
        self.sport = sport
        self.commits = 0
        self.rollbacks = 0

    def query(self, model):
        if model is Sport:
            return _FakeQuery(self.sport)
        return _FakeQuery(self.matches)

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


def _stale_match():
    return SimpleNamespace(
        id=uuid.uuid4(),
        external_api_id="feeder:stale-1",
        status="live",
        home_team="Man Utd",
        away_team="Spurs",
        home_score=4,
        away_score=0,
        match_date=datetime.now(timezone.utc) - timedelta(hours=6),
        competition="Premier League",
        sport_id=uuid.uuid4(),
        updated_at=datetime.now(timezone.utc) - timedelta(hours=5),
    )


def test_finalize_stale_live_matches(monkeypatch):
    # Stub the lazily-imported scoring trigger so the celery import cycle
    # never loads in tests.
    enqueue_calls = []
    stub = types.ModuleType("app.services.scoring.scoring_trigger")
    stub.enqueue_scoring_for_finished_match = (
        lambda db, **kw: enqueue_calls.append(kw) or 1
    )
    monkeypatch.setitem(sys.modules, "app.services.scoring.scoring_trigger", stub)

    booked = []
    monkeypatch.setattr(
        fs, "persist_match_stats", lambda db, **kw: booked.append(kw) or {"players": 2, "windows": 1}
    )

    match = _stale_match()
    db = _FakeDB(matches=[match], sport=SimpleNamespace(name="Football"))
    published = []
    redis = SimpleNamespace(publish=lambda channel, msg: published.append((channel, msg)))

    stats = fs.finalize_stale_live_matches(db, redis)

    assert stats == {"stale": 1, "finalized": 1}
    assert match.status == "finished"
    assert db.commits == 1 and db.rollbacks == 0
    assert booked[0]["sport"] == "football"
    assert enqueue_calls[0]["sport_id"] == match.sport_id
    assert len(published) == 1
    channel, payload = published[0]
    assert channel.endswith(":feeder:stale-1")
    assert '"status":"finished"' in payload.replace(" ", "")


def test_persist_failure_skips_match_and_rolls_back(monkeypatch):
    stub = types.ModuleType("app.services.scoring.scoring_trigger")
    stub.enqueue_scoring_for_finished_match = lambda db, **kw: 1
    monkeypatch.setitem(sys.modules, "app.services.scoring.scoring_trigger", stub)

    def _boom(db, **kw):
        raise RuntimeError("stat tables unavailable")

    monkeypatch.setattr(fs, "persist_match_stats", _boom)

    match = _stale_match()
    db = _FakeDB(matches=[match], sport=SimpleNamespace(name="Football"))
    published = []
    redis = SimpleNamespace(publish=lambda channel, msg: published.append((channel, msg)))

    stats = fs.finalize_stale_live_matches(db, redis)

    assert stats == {"stale": 1, "finalized": 0}
    assert db.rollbacks == 1 and db.commits == 0
    assert published == []

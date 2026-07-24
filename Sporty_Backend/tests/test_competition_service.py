"""Competition snapshot read-through cache (public competition pages).

Verifies: current-season TTL refresh vs historical immutability, that a fetch
failure serves stale rather than erroring, and season-window validation.
No live football-data.org calls — the fetchers are monkeypatched. Async
service is driven via asyncio.run, matching the suite's convention.
"""
from __future__ import annotations

import asyncio
import os
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

_temp_dir = tempfile.mkdtemp(prefix="sporty-competition-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'comp.db'}"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["JWT_SECRET_KEY"] = "x" * 32
os.environ["GOOGLE_CLIENT_ID"] = "test-client"

_backend_root = Path(__file__).resolve().parents[1]
os.chdir(_temp_dir)
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from app.database import Base  # noqa: E402
from app.competition import service  # noqa: E402
from app.models.db.competition_snapshot import CompetitionSnapshot  # noqa: E402

ENGINE = create_engine(os.environ["DATABASE_URL"])
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=ENGINE)


@pytest.fixture()
def db():
    Base.metadata.drop_all(bind=ENGINE)
    Base.metadata.create_all(bind=ENGINE)
    s = SessionLocal()
    try:
        yield s
    finally:
        s.close()


def _patch_standings(monkeypatch, payload, counter):
    async def fake(code, season=None, *a, **k):
        counter.append((code, season))
        return payload

    monkeypatch.setitem(service._KIND_FETCHERS, "standings", fake)


def test_historical_season_fetched_once(db, monkeypatch):
    calls = []
    _patch_standings(monkeypatch, {"standings": [{"table": []}], "v": 1}, calls)
    season = service.available_seasons()[-1]  # oldest allowed = historical

    first = asyncio.run(service.get_snapshot(db, "EPL", "standings", season))
    second = asyncio.run(service.get_snapshot(db, "EPL", "standings", season))
    assert first["v"] == 1 and second["v"] == 1
    assert len(calls) == 1  # immutable: fetched once, then cache-served
    assert db.query(CompetitionSnapshot).count() == 1


def test_current_season_refetches_when_stale(db, monkeypatch):
    calls = []
    _patch_standings(monkeypatch, {"standings": [{"table": []}], "v": 1}, calls)
    season = service.current_season()

    asyncio.run(service.get_snapshot(db, "EPL", "standings", season))
    assert len(calls) == 1
    # A second immediate read is within TTL — no refetch.
    asyncio.run(service.get_snapshot(db, "EPL", "standings", season))
    assert len(calls) == 1
    # Age the row past the TTL → next read refetches.
    row = db.query(CompetitionSnapshot).one()
    row.updated_at = datetime.now(timezone.utc) - timedelta(hours=12)
    db.commit()
    asyncio.run(service.get_snapshot(db, "EPL", "standings", season))
    assert len(calls) == 2


def test_serves_stale_on_fetch_failure(db, monkeypatch):
    calls = []
    _patch_standings(monkeypatch, {"v": "good"}, calls)
    season = service.current_season()
    asyncio.run(service.get_snapshot(db, "EPL", "standings", season))

    async def boom(code, season=None, *a, **k):
        raise RuntimeError("fdo down")

    monkeypatch.setitem(service._KIND_FETCHERS, "standings", boom)
    row = db.query(CompetitionSnapshot).one()
    row.updated_at = datetime.now(timezone.utc) - timedelta(hours=12)  # force refetch attempt
    db.commit()
    result = asyncio.run(service.get_snapshot(db, "EPL", "standings", season))
    assert result == {"v": "good"}  # stale served, no raise


def test_invalid_tag_and_season_rejected(db):
    with pytest.raises(ValueError):
        asyncio.run(service.get_snapshot(db, "SERIEA", "standings", service.current_season()))
    with pytest.raises(ValueError):
        asyncio.run(service.get_snapshot(db, "EPL", "standings", 2019))  # before horizon

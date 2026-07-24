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
    # Current-view fetch (season=None); payload carries a season object so the
    # service can resolve which year to store under.
    payload = {"season": {"startDate": "2026-08-01"}, "standings": [{"table": []}], "v": 1}
    _patch_standings(monkeypatch, payload, calls)

    asyncio.run(service.get_snapshot(db, "EPL", "standings", None))
    assert len(calls) == 1
    # A second immediate read is within TTL — no refetch.
    asyncio.run(service.get_snapshot(db, "EPL", "standings", None))
    assert len(calls) == 1
    # Age the row past the TTL → next read refetches.
    row = db.query(CompetitionSnapshot).one()
    assert row.season == 2026  # stored under the resolved season, not forced
    row.updated_at = datetime.now(timezone.utc) - timedelta(hours=12)
    db.commit()
    asyncio.run(service.get_snapshot(db, "EPL", "standings", None))
    assert len(calls) == 2


def test_serves_stale_on_fetch_failure(db, monkeypatch):
    calls = []
    payload = {"season": {"startDate": "2026-08-01"}, "v": "good"}
    _patch_standings(monkeypatch, payload, calls)
    asyncio.run(service.get_snapshot(db, "EPL", "standings", None))

    async def boom(code, season=None, *a, **k):
        raise RuntimeError("fdo down")

    monkeypatch.setitem(service._KIND_FETCHERS, "standings", boom)
    row = db.query(CompetitionSnapshot).one()
    row.updated_at = datetime.now(timezone.utc) - timedelta(hours=12)  # force refetch attempt
    db.commit()
    result = asyncio.run(service.get_snapshot(db, "EPL", "standings", None))
    assert result == payload  # stale served, no raise


def test_invalid_tag_and_season_rejected(db):
    with pytest.raises(ValueError):
        asyncio.run(service.get_snapshot(db, "SERIEA", "standings", service.current_season()))
    with pytest.raises(ValueError):
        asyncio.run(service.get_snapshot(db, "EPL", "standings", 2019))  # before horizon


def test_ucl_is_display_only_not_fantasy():
    """Champions League must appear on the competition pages but never be a
    fantasy option (no player pools, not a valid competition_filter)."""
    import uuid

    from app.league.schemas import LeagueCreate
    from app.services.sync.football_competitions import (
        FOOTBALL_COMPETITIONS,
        fantasy_competitions,
    )

    all_tags = {c.tag for c in FOOTBALL_COMPETITIONS.values()}
    fantasy_tags = {c.tag for c in fantasy_competitions().values()}
    assert "UCL" in all_tags        # shown on competition pages
    assert "UCL" not in fantasy_tags  # never a fantasy competition

    # The create-league validator must reject UCL as a football pool filter.
    with pytest.raises(Exception):
        LeagueCreate(
            name="x", season_id=uuid.uuid4(), sports=["football"],
            competition_filters={"football": "UCL"},
        )


def test_get_match_finds_and_misses(db):
    from app.models.db.competition_snapshot import CompetitionSnapshot

    db.add(CompetitionSnapshot(
        competition="UCL", season=2025, kind="matches",
        payload={"matches": [
            {"id": 900, "utcDate": "2026-05-30T20:00:00Z", "status": "FINISHED",
             "stage": "FINAL", "homeTeam": {"name": "PSG"}, "awayTeam": {"name": "Arsenal"},
             "score": {"fullTime": {"home": 2, "away": 1}}},
        ]},
    ))
    db.commit()
    found = service.get_match(db, "UCL", "900")
    assert found is not None and found["stage"] == "FINAL" and found["homeTeam"]["name"] == "PSG"
    assert service.get_match(db, "UCL", "404") is None      # unknown id
    assert service.get_match(db, "SERIEA", "900") is None    # unknown competition

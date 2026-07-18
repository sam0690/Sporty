"""cache_warming_service.warm_cache hardcoded max_total=15 for every sport's
transfer_rules:{sport} cache entry — correct for football/mixed (squad_size
15) but wrong for basketball (13), and since that Redis entry is checked
before _transfer_rules' DB-computed fallback (transfer_service.py), it made
every basketball transfer confirmation fail with "Final squad must have
exactly 15 players" for the cache's 24h TTL. This pins max_total to the
real per-sport squad size (app/league/sportConfigs.get_squad_size)."""
from __future__ import annotations

import asyncio
import json
import os
import sys
import tempfile
import uuid
from contextlib import contextmanager
from datetime import date, timedelta
from pathlib import Path

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")
os.environ.setdefault("JWT_SECRET_KEY", "x" * 32)
os.environ.setdefault("GOOGLE_CLIENT_ID", "test-client")

_temp_dir = tempfile.mkdtemp(prefix="sporty-cache-warming-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'cache_warming.db'}"

_backend_root = Path(__file__).resolve().parents[1]
os.chdir(_temp_dir)
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.auth.models import AuthProvider, User
import app.match.models  # noqa: F401
import app.player.models_nba  # noqa: F401
from app.league import services as league_service
from app.league.models import LeagueStatus, Season, Sport
from app.league.schemas import LeagueCreate
from app.services.cache_warming_service import warm_cache

ENGINE = create_engine(os.environ["DATABASE_URL"])
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=ENGINE)


@contextmanager
def session_scope():
    Base.metadata.drop_all(bind=ENGINE)
    Base.metadata.create_all(bind=ENGINE)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class _FakePipeline:
    def __init__(self, store: dict[str, str]):
        self._store = store

    def delete(self, *_args, **_kwargs):
        return self

    def hset(self, *_args, **_kwargs):
        return self

    def sadd(self, *_args, **_kwargs):
        return self

    def set(self, *_args, **_kwargs):
        return self

    def setex(self, key: str, _ttl: int, value: str):
        self._store[key] = value
        return self

    def execute(self):
        return []


class _FakeRedis:
    def __init__(self):
        self.store: dict[str, str] = {}

    def pipeline(self, transaction: bool = True):
        return _FakePipeline(self.store)


def test_warm_cache_writes_real_squad_size_per_sport():
    with session_scope() as db:
        football = Sport(name="football", display_name="Football")
        basketball = Sport(name="basketball", display_name="Basketball")
        db.add_all([football, basketball])
        db.flush()

        owner = User(
            username="owner", email="owner@example.com",
            auth_provider=AuthProvider.LOCAL, password_hash="hashed",
        )
        db.add(owner)
        db.flush()

        season = Season(
            sport_id=basketball.id, name="Season-1",
            start_date=date(2025, 8, 1), end_date=date(2026, 5, 31), is_active=True,
        )
        db.add(season)
        db.flush()

        league = league_service.create_league(
            db,
            LeagueCreate(
                name="NBA League", season_id=season.id, draft_mode=False,
                budget_per_team=100, sports=["basketball"],
            ),
            owner,
        )
        league.status = LeagueStatus.ACTIVE
        db.flush()

        redis = _FakeRedis()
        asyncio.run(warm_cache(db, redis))

        basketball_rules = json.loads(redis.store["transfer_rules:basketball"])
        assert basketball_rules["max_total"] == 13
        assert "max_starters" not in basketball_rules
        assert "max_bench" not in basketball_rules

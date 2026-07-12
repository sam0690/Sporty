from __future__ import annotations

import os
import sys
import tempfile
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_temp_dir = tempfile.mkdtemp(prefix="sporty-match-date-filter-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'match_date_filter.db'}"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["JWT_SECRET_KEY"] = "x" * 32
os.environ["GOOGLE_CLIENT_ID"] = "test-client"

_backend_root = Path(__file__).resolve().parents[1]
os.chdir(_temp_dir)
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from app.database import Base, get_db
from app.auth.dependencies import get_current_active_user
from app.auth.models import AuthProvider, User, UserRole
import app.player.models  # noqa: F401
import app.player.models_nba  # noqa: F401
from app.league.models import Sport
from app.match.models import Match
from app.match.router import router as match_router

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


def _make_match(db, sport: Sport, *, when: datetime, external_id: str) -> Match:
    match = Match(
        sport_id=sport.id,
        external_api_id=external_id,
        home_team="Home",
        away_team="Away",
        match_date=when,
        status="scheduled",
        competition="Test League",
        season="2026",
    )
    db.add(match)
    db.flush()
    return match


def _build_app(db, user: User) -> FastAPI:
    app = FastAPI()
    app.include_router(match_router, prefix="/api/v1")

    def _override_get_db():
        yield db

    def _override_current_user():
        return user

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_active_user] = _override_current_user
    return app


def test_date_filter_returns_only_matches_on_that_day():
    with session_scope() as db:
        user = User(
            username="tester",
            email="tester@example.com",
            auth_provider=AuthProvider.LOCAL,
            password_hash="hashed",
            role=UserRole.USER,
        )
        db.add(user)
        sport = Sport(name="football", display_name="Football")
        db.add(sport)
        db.flush()

        today_noon = datetime(2026, 7, 12, 12, 0, tzinfo=timezone.utc)
        _make_match(db, sport, when=today_noon - timedelta(days=1), external_id="yesterday")
        _make_match(db, sport, when=today_noon, external_id="today")
        _make_match(db, sport, when=today_noon + timedelta(days=1), external_id="tomorrow")
        db.commit()

        app = _build_app(db, user)
        client = TestClient(app)

        resp = client.get("/api/v1/matches", params={"date": "2026-07-12"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 1
        assert body["items"][0]["external_api_id"] == "today"


def test_date_filter_rejects_bad_format():
    with session_scope() as db:
        user = User(
            username="tester2",
            email="tester2@example.com",
            auth_provider=AuthProvider.LOCAL,
            password_hash="hashed",
            role=UserRole.USER,
        )
        db.add(user)
        db.commit()

        app = _build_app(db, user)
        client = TestClient(app)

        resp = client.get("/api/v1/matches", params={"date": "not-a-date"})
        assert resp.status_code == 422

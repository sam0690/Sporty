from __future__ import annotations

import os
import sys
import tempfile
import uuid
from contextlib import contextmanager
from datetime import date, timedelta
from pathlib import Path

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_temp_dir = tempfile.mkdtemp(prefix="sporty-admin-seasons-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'admin_seasons.db'}"
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
import app.match.models  # noqa: F401
import app.player.models  # noqa: F401
import app.player.models_nba  # noqa: F401
from app.admin import services as admin_services
from app.admin.models import AdminActionType, AdminAuditLog
from app.admin.router import router as admin_router
from app.league.models import Season, Sport

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


def _make_user(db, role: UserRole = UserRole.ADMIN) -> User:
    user = User(
        username=f"{role.value}-{uuid.uuid4().hex[:8]}",
        email=f"{uuid.uuid4().hex[:8]}@example.com",
        auth_provider=AuthProvider.LOCAL,
        password_hash="hashed",
        role=role,
    )
    db.add(user)
    db.flush()
    return user


def _make_season(db, sport: Sport, *, start: date, end: date, name: str | None = None) -> Season:
    season = Season(
        sport_id=sport.id,
        name=name or f"Season-{uuid.uuid4().hex[:8]}",
        start_date=start,
        end_date=end,
    )
    db.add(season)
    db.flush()
    return season


def _build_app(db, user: User) -> FastAPI:
    app = FastAPI()
    app.include_router(admin_router, prefix="/api/v1")

    def _override_get_db():
        yield db

    def _override_current_user():
        return user

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_active_user] = _override_current_user
    return app


# ── update_season_admin (service level) ─────────────────────────────────────────


def test_update_season_admin_edits_name_and_dates_and_audits():
    with session_scope() as db:
        actor = _make_user(db)
        sport = Sport(name="football", display_name="Football")
        db.add(sport)
        db.flush()
        season = _make_season(db, sport, start=date(2026, 1, 1), end=date(2026, 6, 30))
        db.commit()

        updated = admin_services.update_season_admin(
            db, actor, season.id,
            name="Renamed Season",
            start_date=date(2026, 2, 1),
            end_date=date(2026, 7, 31),
            reason="fixing typo",
        )
        assert updated.name == "Renamed Season"
        assert updated.start_date == date(2026, 2, 1)
        assert updated.end_date == date(2026, 7, 31)

        log = db.query(AdminAuditLog).filter(AdminAuditLog.action == AdminActionType.SEASON_UPDATE).first()
        assert log is not None
        assert log.target_id == str(season.id)
        assert log.reason == "fixing typo"


def test_update_season_admin_deactivate():
    with session_scope() as db:
        actor = _make_user(db)
        sport = Sport(name="football", display_name="Football")
        db.add(sport)
        db.flush()
        season = _make_season(db, sport, start=date(2026, 1, 1), end=date(2026, 6, 30))
        db.commit()

        updated = admin_services.update_season_admin(db, actor, season.id, is_active=False)
        assert updated.is_active is False


def test_update_season_admin_rejects_end_before_start():
    with session_scope() as db:
        actor = _make_user(db)
        sport = Sport(name="football", display_name="Football")
        db.add(sport)
        db.flush()
        season = _make_season(db, sport, start=date(2026, 1, 1), end=date(2026, 6, 30))
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            admin_services.update_season_admin(db, actor, season.id, end_date=date(2025, 12, 31))
        assert exc_info.value.status_code == 422


def test_update_season_admin_rejects_conflicting_start_date_same_sport():
    # The date-range-overlap ExcludeConstraint is Postgres-only and skipped
    # under this repo's SQLite test shims (see conftest.py), so this exercises
    # the portable uq_season_sport_start constraint instead — same
    # IntegrityError -> 409 code path create_season_admin already relies on.
    with session_scope() as db:
        actor = _make_user(db)
        sport = Sport(name="football", display_name="Football")
        db.add(sport)
        db.flush()
        shared_start = date(2026, 7, 1)
        _make_season(db, sport, start=shared_start, end=date(2026, 12, 31), name="Other Season")
        season = _make_season(db, sport, start=date(2026, 1, 1), end=date(2027, 6, 30), name="This Season")
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            admin_services.update_season_admin(db, actor, season.id, start_date=shared_start)
        assert exc_info.value.status_code == 409


def test_update_season_admin_404_for_missing():
    with session_scope() as db:
        actor = _make_user(db)
        with pytest.raises(HTTPException) as exc_info:
            admin_services.update_season_admin(db, actor, uuid.uuid4(), name="x")
        assert exc_info.value.status_code == 404


# ── status / is_current computed fields ──────────────────────────────────────────


def test_season_status_and_is_current_derived_from_dates():
    with session_scope() as db:
        sport = Sport(name="football", display_name="Football")
        db.add(sport)
        db.flush()
        today = date.today()

        running = _make_season(db, sport, start=today - timedelta(days=5), end=today + timedelta(days=5), name="Running")
        upcoming = _make_season(db, sport, start=today + timedelta(days=10), end=today + timedelta(days=20), name="Upcoming")
        finished = _make_season(db, sport, start=today - timedelta(days=20), end=today - timedelta(days=10), name="Finished")
        db.commit()

        assert running.status == "running" and running.is_current is True
        assert upcoming.status == "upcoming" and upcoming.is_current is False
        assert finished.status == "finished" and finished.is_current is False


# ── Router-level tier gating ─────────────────────────────────────────────────────


def test_update_season_endpoint_requires_admin_tier():
    with session_scope() as db:
        support_user = _make_user(db, role=UserRole.SUPPORT)
        sport = Sport(name="football", display_name="Football")
        db.add(sport)
        db.flush()
        season = _make_season(db, sport, start=date(2026, 1, 1), end=date(2026, 6, 30))
        db.commit()

        app = _build_app(db, support_user)
        client = TestClient(app)
        resp = client.patch(f"/api/v1/admin/seasons/{season.id}", json={"name": "Nope"})
        assert resp.status_code == 403


def test_update_season_endpoint_allows_admin_tier_and_returns_status():
    with session_scope() as db:
        admin_user = _make_user(db, role=UserRole.ADMIN)
        sport = Sport(name="football", display_name="Football")
        db.add(sport)
        db.flush()
        today = date.today()
        season = _make_season(db, sport, start=today - timedelta(days=1), end=today + timedelta(days=30))
        db.commit()

        app = _build_app(db, admin_user)
        client = TestClient(app)
        resp = client.patch(
            f"/api/v1/admin/seasons/{season.id}", json={"name": "Renamed via API"}
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["name"] == "Renamed via API"
        assert body["status"] == "running"
        assert body["is_current"] is True

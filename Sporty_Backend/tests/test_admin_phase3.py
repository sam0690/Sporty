from __future__ import annotations

import os
import sys
import tempfile
import uuid
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_temp_dir = tempfile.mkdtemp(prefix="sporty-admin-phase3-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'admin_phase3.db'}"
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
from app.admin.feature_flags import get_effective_flag
from app.admin.models import AdminActionType, AdminAuditLog, SystemConfig
from app.admin.router import router as admin_router
from app.core.config import settings

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


def _make_user(db, role: UserRole = UserRole.USER) -> User:
    user = User(
        username=f"{role.value}-{uuid.uuid4().hex[:8]}",
        email=f"{uuid.uuid4().hex[:8]}@example.com",
        auth_provider=AuthProvider.LOCAL,
        password_hash="hashed",
        role=role,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


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


# ── get_effective_flag ───────────────────────────────────────────────────────────

def test_get_effective_flag_uses_db_row_when_present():
    with session_scope() as db:
        db.add(SystemConfig(key="live_polling_enabled", value={"enabled": True}))
        db.commit()
        assert get_effective_flag(db, "live_polling_enabled", default=False) is True


def test_get_effective_flag_falls_back_when_row_absent():
    with session_scope() as db:
        assert get_effective_flag(db, "live_polling_enabled", default=False) is False
        assert get_effective_flag(db, "live_polling_enabled", default=True) is True


def test_get_effective_flag_falls_back_to_settings_attr_when_no_default_given():
    with session_scope() as db:
        # settings.LIVE_POLLING_ENABLED defaults to False and no row exists
        assert get_effective_flag(db, "live_polling_enabled") == settings.LIVE_POLLING_ENABLED


def test_get_effective_flag_fails_safe_on_db_error():
    with session_scope() as db:
        broken_db = MagicMock()
        broken_db.query.side_effect = Exception("connection lost")
        assert get_effective_flag(broken_db, "live_polling_enabled", default=True) is True
        assert get_effective_flag(broken_db, "live_polling_enabled", default=False) is False


# ── Celery job status ────────────────────────────────────────────────────────────

def test_get_celery_jobs_status_flattens_inspect_output():
    fake_inspect = MagicMock()
    fake_inspect.active.return_value = {"worker1@host": [{"name": "score.active_windows", "id": "abc"}]}
    fake_inspect.scheduled.return_value = {}
    fake_inspect.reserved.return_value = {}

    with patch("app.core.celery_app.celery_app.control.inspect", return_value=fake_inspect):
        result = admin_services.get_celery_jobs_status()

    assert result["inspect_reachable"] is True
    assert result["workers_online"] == ["worker1@host"]
    assert result["active"] == [{"worker": "worker1@host", "task": "score.active_windows", "id": "abc"}]
    assert any(entry["task"] == "score.active_transfer_windows" for entry in result["beat_schedule"])


def test_get_celery_jobs_status_degrades_when_broker_unreachable():
    with patch("app.core.celery_app.celery_app.control.inspect", side_effect=Exception("no broker")):
        result = admin_services.get_celery_jobs_status()

    assert result["inspect_reachable"] is False
    assert result["workers_online"] == []
    assert result["active"] == []


# ── Kafka job status ─────────────────────────────────────────────────────────────

def test_get_kafka_jobs_status_reports_alive_and_dead_workers():
    fake_redis = MagicMock()

    def _ttl(key):
        if "normalizer" in key:
            return 12  # alive, recently heartbeated
        return -2  # missing / expired

    fake_redis.ttl.side_effect = _ttl

    with patch("app.core.redis.get_redis", return_value=fake_redis):
        result = admin_services.get_kafka_jobs_status()

    by_name = {w["name"]: w for w in result["workers"]}
    assert by_name["normalizer"]["alive"] is True
    assert by_name["normalizer"]["last_seen_seconds_ago"] == 30 - 12
    assert by_name["points-engine"]["alive"] is False
    assert by_name["notifications"]["alive"] is False


def test_get_kafka_jobs_status_fails_safe_when_redis_unreachable():
    with patch("app.core.redis.get_redis", side_effect=Exception("connection refused")):
        result = admin_services.get_kafka_jobs_status()

    assert all(w["alive"] is False for w in result["workers"])


# ── System config toggles ────────────────────────────────────────────────────────

def test_toggle_live_polling_inserts_then_updates_and_audits():
    with session_scope() as db:
        admin = _make_user(db, role=UserRole.ADMIN)
        db.commit()

        row = admin_services.toggle_live_polling(db, admin, True, reason="testing")
        assert row.value == {"enabled": True}

        row2 = admin_services.toggle_live_polling(db, admin, False)
        assert row2.value == {"enabled": False}
        # still one row, not two
        assert db.query(SystemConfig).filter(SystemConfig.key == "live_polling_enabled").count() == 1

        entry = (
            db.query(AdminAuditLog)
            .filter(AdminAuditLog.action == AdminActionType.FEATURE_FLAG_TOGGLE)
            .filter(AdminAuditLog.target_id == "live_polling_enabled")
            .all()
        )
        assert len(entry) == 2


def test_toggle_realtime_pipeline_audits_with_restart_note():
    with session_scope() as db:
        admin = _make_user(db, role=UserRole.SUPER_ADMIN)
        db.commit()

        row = admin_services.toggle_realtime_pipeline(db, admin, True)
        assert row.value == {"enabled": True}
        assert "restart" in (row.description or "").lower()


def test_list_system_config_returns_all_rows_sorted():
    with session_scope() as db:
        admin = _make_user(db, role=UserRole.ADMIN)
        db.commit()
        admin_services.toggle_live_polling(db, admin, True)
        admin_services.toggle_realtime_pipeline(db, admin, False)

        rows = admin_services.list_system_config(db)
        keys = [r.key for r in rows]
        assert keys == sorted(keys)
        assert set(keys) == {"live_polling_enabled", "realtime_pipeline_enabled"}


# ── Router-level tier gating ─────────────────────────────────────────────────────

def test_jobs_endpoints_allow_support_tier():
    with session_scope() as db:
        support_user = _make_user(db, role=UserRole.SUPPORT)
        db.commit()
        app = _build_app(db, support_user)
        client = TestClient(app)

        with patch("app.core.celery_app.celery_app.control.inspect", side_effect=Exception("no broker")):
            resp = client.get("/api/v1/admin/jobs/celery")
        assert resp.status_code == 200

        with patch("app.core.redis.get_redis", side_effect=Exception("no redis")):
            resp = client.get("/api/v1/admin/jobs/kafka")
        assert resp.status_code == 200


def test_realtime_pipeline_toggle_requires_super_admin_tier():
    with session_scope() as db:
        admin_user = _make_user(db, role=UserRole.ADMIN)
        db.commit()
        app = _build_app(db, admin_user)
        client = TestClient(app)
        resp = client.post("/api/v1/admin/config/realtime-pipeline", json={"enabled": True})
        assert resp.status_code == 403


def test_live_polling_toggle_allows_admin_tier():
    with session_scope() as db:
        admin_user = _make_user(db, role=UserRole.ADMIN)
        db.commit()
        app = _build_app(db, admin_user)
        client = TestClient(app)
        resp = client.post("/api/v1/admin/config/live-polling", json={"enabled": True})
        assert resp.status_code == 200

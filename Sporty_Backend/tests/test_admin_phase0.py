from __future__ import annotations

import os
import sys
import tempfile
import uuid
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_temp_dir = tempfile.mkdtemp(prefix="sporty-admin-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'admin.db'}"
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
from app.admin.audit import record_admin_action
from app.admin.dependencies import _ROLE_RANK, require_admin_role
from app.admin.models import AdminActionType, AdminAuditLog
from app.admin.router import router as admin_router

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


def _make_user(role: UserRole) -> User:
    return User(
        id=uuid.uuid4(),
        username=f"{role.value}-user",
        email=f"{role.value}@example.com",
        auth_provider=AuthProvider.LOCAL,
        password_hash="hashed",
        role=role,
        is_active=True,
    )


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


# ── _ROLE_RANK ordering ────────────────────────────────────────────────────────

def test_role_rank_ordering():
    assert (
        _ROLE_RANK[UserRole.USER]
        < _ROLE_RANK[UserRole.SUPPORT]
        < _ROLE_RANK[UserRole.ADMIN]
        < _ROLE_RANK[UserRole.SUPER_ADMIN]
    )


# ── require_admin_role dependency ──────────────────────────────────────────────

@pytest.mark.parametrize(
    "actual_role,min_role",
    [
        (UserRole.ADMIN, UserRole.ADMIN),
        (UserRole.SUPER_ADMIN, UserRole.ADMIN),
        (UserRole.SUPPORT, UserRole.SUPPORT),
    ],
)
def test_require_admin_role_allows_equal_or_higher_tier(actual_role, min_role):
    user = _make_user(actual_role)
    dep = require_admin_role(min_role)
    assert dep(current_user=user) is user


@pytest.mark.parametrize(
    "actual_role,min_role",
    [
        (UserRole.USER, UserRole.SUPPORT),
        (UserRole.SUPPORT, UserRole.ADMIN),
        (UserRole.ADMIN, UserRole.SUPER_ADMIN),
    ],
)
def test_require_admin_role_rejects_lower_tier(actual_role, min_role):
    user = _make_user(actual_role)
    dep = require_admin_role(min_role)
    with pytest.raises(HTTPException) as exc_info:
        dep(current_user=user)
    assert exc_info.value.status_code == 403


# ── record_admin_action ─────────────────────────────────────────────────────────

def test_record_admin_action_adds_row_without_committing():
    db = MagicMock()
    actor = _make_user(UserRole.SUPER_ADMIN)

    entry = record_admin_action(
        db,
        actor=actor,
        action=AdminActionType.USER_SUSPEND,
        target_type="user",
        target_id=uuid.uuid4(),
        reason="fraud report",
        metadata={"note": "test"},
    )

    db.add.assert_called_once_with(entry)
    db.commit.assert_not_called()
    assert isinstance(entry, AdminAuditLog)
    assert entry.actor_user_id == actor.id
    assert entry.actor_username_snapshot == actor.username
    assert entry.action == AdminActionType.USER_SUSPEND
    assert entry.target_type == "user"
    assert entry.reason == "fraud report"


# ── GET /admin/audit-log endpoint ──────────────────────────────────────────────

def test_audit_log_endpoint_allows_support_tier_and_above():
    with session_scope() as db:
        support_user = _make_user(UserRole.SUPPORT)
        db.add(support_user)
        db.flush()
        record_admin_action(
            db,
            actor=support_user,
            action=AdminActionType.USER_FORCE_LOGOUT,
            target_type="user",
            target_id=uuid.uuid4(),
        )
        db.commit()

        app = _build_app(db, support_user)
        client = TestClient(app)
        resp = client.get("/api/v1/admin/audit-log")

        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 1
        assert body["items"][0]["action"] == "user_force_logout"


def test_audit_log_endpoint_rejects_plain_user():
    with session_scope() as db:
        plain_user = _make_user(UserRole.USER)
        db.add(plain_user)
        db.flush()
        db.commit()

        app = _build_app(db, plain_user)
        client = TestClient(app)
        resp = client.get("/api/v1/admin/audit-log")

        assert resp.status_code == 403

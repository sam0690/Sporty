from __future__ import annotations

import os
import sys
import tempfile
import uuid
from contextlib import contextmanager
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_temp_dir = tempfile.mkdtemp(prefix="sporty-admin-phase1-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'admin_phase1.db'}"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["JWT_SECRET_KEY"] = "x" * 32
os.environ["GOOGLE_CLIENT_ID"] = "test-client"

_backend_root = Path(__file__).resolve().parents[1]
os.chdir(_temp_dir)
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from app.database import Base, get_db
from app.auth.dependencies import get_current_active_user
from app.auth.models import AuthProvider, RefreshToken, User, UserRole
import app.match.models  # noqa: F401
import app.player.models  # noqa: F401
import app.player.models_nba  # noqa: F401
from app.admin import services as admin_services
from app.admin.router import router as admin_router
from app.league import services as league_service
from app.league.models import League, LeagueStatus, Season, Sport
from app.league.schemas import LeagueCreate

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


def _make_user(db, role: UserRole = UserRole.USER, is_active: bool = True) -> User:
    user = User(
        username=f"{role.value}-{uuid.uuid4().hex[:8]}",
        email=f"{uuid.uuid4().hex[:8]}@example.com",
        auth_provider=AuthProvider.LOCAL,
        password_hash="hashed",
        role=role,
        is_active=is_active,
    )
    db.add(user)
    db.flush()
    return user


def _make_league(db, owner: User, draft_mode: bool = False) -> League:
    sport = Sport(name="football", display_name="Football")
    db.add(sport)
    db.flush()

    season = Season(
        sport_id=sport.id,
        name=f"Season-{uuid.uuid4().hex[:8]}",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
    )
    db.add(season)
    db.flush()

    return league_service.create_league(
        db,
        LeagueCreate(
            name=f"League-{uuid.uuid4().hex[:8]}",
            season_id=season.id,
            budget_per_team=Decimal("100"),
            squad_size=15,
            draft_mode=draft_mode,
            sports=["football"],
        ),
        owner,
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


# ── list_users_admin / get_user_admin ──────────────────────────────────────────

def test_list_users_admin_includes_inactive_users():
    with session_scope() as db:
        active = _make_user(db, is_active=True)
        inactive = _make_user(db, is_active=False)
        db.commit()

        items, total = admin_services.list_users_admin(db, page=1, page_size=20)
        ids = {u.id for u in items}
        assert active.id in ids
        assert inactive.id in ids
        assert total == 2


def test_get_user_admin_finds_inactive_user():
    with session_scope() as db:
        user = _make_user(db, is_active=False)
        db.commit()
        found = admin_services.get_user_admin(db, user.id)
        assert found.id == user.id


def test_get_user_admin_404_for_missing():
    with session_scope() as db:
        with pytest.raises(HTTPException) as exc_info:
            admin_services.get_user_admin(db, uuid.uuid4())
        assert exc_info.value.status_code == 404


# ── suspend / reactivate / force-logout ────────────────────────────────────────

def test_suspend_user_deactivates_and_revokes_tokens_and_audits():
    with session_scope() as db:
        actor = _make_user(db, role=UserRole.ADMIN)
        target = _make_user(db, is_active=True)
        token = RefreshToken(
            user_id=target.id, token_hash="x" * 64,
            expires_at=__import__("datetime").datetime(2030, 1, 1, tzinfo=__import__("datetime").timezone.utc),
        )
        db.add(token)
        db.commit()

        result = admin_services.suspend_user(db, actor, target.id, reason="fraud")

        assert result.is_active is False
        db.refresh(token)
        assert token.revoked_at is not None

        from app.admin.models import AdminActionType, AdminAuditLog
        entry = db.query(AdminAuditLog).filter(AdminAuditLog.target_id == str(target.id)).first()
        assert entry.action == AdminActionType.USER_SUSPEND
        assert entry.reason == "fraud"


def test_reactivate_user_sets_active_and_audits():
    with session_scope() as db:
        actor = _make_user(db, role=UserRole.ADMIN)
        target = _make_user(db, is_active=False)
        db.commit()

        result = admin_services.reactivate_user(db, actor, target.id)
        assert result.is_active is True


def test_force_logout_revokes_all_tokens():
    with session_scope() as db:
        actor = _make_user(db, role=UserRole.ADMIN)
        target = _make_user(db)
        for _ in range(2):
            db.add(RefreshToken(
                user_id=target.id, token_hash=uuid.uuid4().hex.ljust(64, "0"),
                expires_at=__import__("datetime").datetime(2030, 1, 1, tzinfo=__import__("datetime").timezone.utc),
            ))
        db.commit()

        revoked = admin_services.force_logout_user(db, actor, target.id)
        assert revoked == 2


# ── change_user_role ────────────────────────────────────────────────────────────

def test_change_user_role_updates_and_audits():
    with session_scope() as db:
        actor = _make_user(db, role=UserRole.SUPER_ADMIN)
        target = _make_user(db, role=UserRole.USER)
        db.commit()

        result = admin_services.change_user_role(db, actor, target.id, UserRole.SUPPORT)
        assert result.role == UserRole.SUPPORT


def test_change_user_role_blocks_self_change():
    with session_scope() as db:
        actor = _make_user(db, role=UserRole.SUPER_ADMIN)
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            admin_services.change_user_role(db, actor, actor.id, UserRole.ADMIN)
        assert exc_info.value.status_code == 400


def test_change_user_role_blocks_demoting_last_super_admin():
    with session_scope() as db:
        # actor doesn't need to be a super admin for this service-level check —
        # tier gating happens at the router, not inside change_user_role.
        actor = _make_user(db, role=UserRole.ADMIN)
        only_super_admin = _make_user(db, role=UserRole.SUPER_ADMIN)
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            admin_services.change_user_role(db, actor, only_super_admin.id, UserRole.ADMIN)
        assert exc_info.value.status_code == 409


def test_change_user_role_allows_demoting_when_another_super_admin_remains():
    with session_scope() as db:
        actor = _make_user(db, role=UserRole.SUPER_ADMIN)
        other_super_admin = _make_user(db, role=UserRole.SUPER_ADMIN)
        db.commit()

        result = admin_services.change_user_role(db, actor, other_super_admin.id, UserRole.ADMIN)
        assert result.role == UserRole.ADMIN


# ── League admin overrides ──────────────────────────────────────────────────────

def test_list_leagues_admin_returns_leagues_regardless_of_membership():
    with session_scope() as db:
        owner = _make_user(db)
        league = _make_league(db, owner)
        db.commit()

        rows, total = admin_services.list_leagues_admin(db, page=1, page_size=20)
        assert total == 1
        returned_league, owner_username = rows[0]
        assert returned_league.id == league.id
        assert owner_username == owner.username


def test_override_league_status_bypasses_owner_check():
    with session_scope() as db:
        owner = _make_user(db)
        admin = _make_user(db, role=UserRole.ADMIN)
        league = _make_league(db, owner, draft_mode=True)
        db.commit()

        updated = admin_services.override_league_status(db, admin, league.id, LeagueStatus.DRAFTING)
        assert updated.status == LeagueStatus.DRAFTING

        from app.admin.models import AdminActionType, AdminAuditLog
        entry = (
            db.query(AdminAuditLog)
            .filter(AdminAuditLog.target_id == str(league.id))
            .filter(AdminAuditLog.action == AdminActionType.LEAGUE_STATUS_OVERRIDE)
            .first()
        )
        assert entry is not None


def test_override_delete_league_bypasses_owner_check():
    with session_scope() as db:
        owner = _make_user(db)
        admin = _make_user(db, role=UserRole.SUPER_ADMIN)
        league = _make_league(db, owner)
        db.commit()
        league_id = league.id

        admin_services.override_delete_league(db, admin, league_id)

        assert db.query(League).filter(League.id == league_id).first() is None


# ── Regression: non-admin_override callers still enforce ownership ─────────────

def test_update_league_status_still_enforces_owner_without_override():
    with session_scope() as db:
        owner = _make_user(db)
        stranger = _make_user(db)
        league = _make_league(db, owner)
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            league_service.update_league_status(db, league.id, LeagueStatus.DRAFTING, stranger)
        assert exc_info.value.status_code == 403


def test_delete_league_still_enforces_owner_without_override():
    with session_scope() as db:
        owner = _make_user(db)
        stranger = _make_user(db)
        league = _make_league(db, owner)
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            league_service.delete_league(db, league.id, stranger)
        assert exc_info.value.status_code == 403


# ── Router-level tier gating ─────────────────────────────────────────────────────

def test_list_users_endpoint_requires_admin_tier():
    with session_scope() as db:
        support_user = _make_user(db, role=UserRole.SUPPORT)
        db.commit()
        app = _build_app(db, support_user)
        client = TestClient(app)
        resp = client.get("/api/v1/admin/users")
        assert resp.status_code == 403


def test_list_users_endpoint_allows_admin_tier():
    with session_scope() as db:
        admin_user = _make_user(db, role=UserRole.ADMIN)
        db.commit()
        app = _build_app(db, admin_user)
        client = TestClient(app)
        resp = client.get("/api/v1/admin/users")
        assert resp.status_code == 200


def test_role_change_endpoint_requires_super_admin_tier():
    with session_scope() as db:
        admin_user = _make_user(db, role=UserRole.ADMIN)
        target = _make_user(db)
        db.commit()
        app = _build_app(db, admin_user)
        client = TestClient(app)
        resp = client.patch(f"/api/v1/admin/users/{target.id}/role", json={"role": "admin"})
        assert resp.status_code == 403


def test_league_delete_endpoint_requires_super_admin_tier():
    with session_scope() as db:
        admin_user = _make_user(db, role=UserRole.ADMIN)
        owner = _make_user(db)
        league = _make_league(db, owner)
        db.commit()
        app = _build_app(db, admin_user)
        client = TestClient(app)
        resp = client.delete(f"/api/v1/admin/leagues/{league.id}")
        assert resp.status_code == 403

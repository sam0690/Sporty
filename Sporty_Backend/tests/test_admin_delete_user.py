"""delete_user_admin — FK-safety guardrails, self-delete block, and
SUPER_ADMIN-only router gating. SQLite throwaway DB, same pattern as
test_admin_seasons.py."""
from __future__ import annotations

import os
import sys
import tempfile
import uuid
from contextlib import contextmanager
from datetime import date, timedelta
from decimal import Decimal
from pathlib import Path

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_temp_dir = tempfile.mkdtemp(prefix="sporty-admin-delete-user-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'admin_delete_user.db'}"
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
from app.league import services as league_service
from app.league.models import FantasyTeam, League, LeagueMembership, Season, Sport
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


def _make_user(db, role: UserRole = UserRole.USER) -> User:
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


def _make_season(db) -> Season:
    # create_league validates sport.name against SUPPORTED_LEAGUE_SPORTS, so
    # this must be the literal "football" — each test gets its own isolated
    # SQLite DB (session_scope drops/recreates), so no cross-test collision.
    sport = Sport(name="football", display_name="Football")
    db.add(sport)
    db.flush()
    today = date.today()
    season = Season(
        sport_id=sport.id, name=f"S-{uuid.uuid4().hex[:6]}",
        start_date=today - timedelta(days=1), end_date=today + timedelta(days=200),
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


def test_deletes_a_clean_user():
    with session_scope() as db:
        actor = _make_user(db, role=UserRole.SUPER_ADMIN)
        target = _make_user(db)
        db.commit()
        target_id = target.id

        admin_services.delete_user_admin(db, actor, target_id)

        assert db.query(User).filter(User.id == target_id).first() is None
        log = db.query(AdminAuditLog).filter(AdminAuditLog.action == AdminActionType.USER_DELETE).first()
        assert log is not None
        assert log.target_id == str(target_id)


def test_blocks_deleting_a_league_owner():
    with session_scope() as db:
        actor = _make_user(db, role=UserRole.SUPER_ADMIN)
        owner = _make_user(db)
        season = _make_season(db)
        db.flush()
        league_service.create_league(
            db, LeagueCreate(name="Owned League", season_id=season.id, draft_mode=False, sports=["football"]), owner,
        )
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            admin_services.delete_user_admin(db, actor, owner.id)

        assert exc_info.value.status_code == 409
        assert "owns 1 league" in exc_info.value.detail
        assert db.query(User).filter(User.id == owner.id).first() is not None


def test_blocks_deleting_a_league_member():
    with session_scope() as db:
        actor = _make_user(db, role=UserRole.SUPER_ADMIN)
        owner = _make_user(db)
        member = _make_user(db)
        season = _make_season(db)
        db.flush()
        league = league_service.create_league(
            db, LeagueCreate(name="Member League", season_id=season.id, draft_mode=False, sports=["football"]), owner,
        )
        db.flush()
        league_service.join_league(db, league.invite_code, member)
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            admin_services.delete_user_admin(db, actor, member.id)

        assert exc_info.value.status_code == 409
        assert "member of 1 league" in exc_info.value.detail


def test_blocks_deleting_a_user_with_a_fantasy_team():
    with session_scope() as db:
        actor = _make_user(db, role=UserRole.SUPER_ADMIN)
        owner = _make_user(db)
        season = _make_season(db)
        db.flush()
        league = league_service.create_league(
            db, LeagueCreate(name="Team League", season_id=season.id, draft_mode=False, sports=["football"]), owner,
        )
        db.flush()
        db.add(FantasyTeam(
            league_id=league.id, user_id=owner.id, name="My Team",
            current_budget=Decimal("100.00"), starting_budget=Decimal("100.00"), starting_squad_size=15,
        ))
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            admin_services.delete_user_admin(db, actor, owner.id)

        assert exc_info.value.status_code == 409
        assert "fantasy team" in exc_info.value.detail


def test_blocks_deleting_an_admin_with_audit_history():
    with session_scope() as db:
        actor = _make_user(db, role=UserRole.SUPER_ADMIN)
        prior_admin = _make_user(db, role=UserRole.ADMIN)
        someone_else = _make_user(db)
        db.add(AdminAuditLog(
            actor_user_id=prior_admin.id, actor_username_snapshot=prior_admin.username,
            action=AdminActionType.USER_SUSPEND, target_type="user", target_id=str(someone_else.id),
        ))
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            admin_services.delete_user_admin(db, actor, prior_admin.id)

        assert exc_info.value.status_code == 409
        assert "admin action" in exc_info.value.detail


def test_blocks_self_delete():
    with session_scope() as db:
        actor = _make_user(db, role=UserRole.SUPER_ADMIN)
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            admin_services.delete_user_admin(db, actor, actor.id)

        assert exc_info.value.status_code == 400


def test_delete_endpoint_requires_super_admin_tier():
    with session_scope() as db:
        admin_user = _make_user(db, role=UserRole.ADMIN)  # ADMIN, not SUPER_ADMIN
        target = _make_user(db)
        db.commit()

        app = _build_app(db, admin_user)
        client = TestClient(app)
        resp = client.delete(f"/api/v1/admin/users/{target.id}")

        assert resp.status_code == 403
        assert db.query(User).filter(User.id == target.id).first() is not None


def test_delete_endpoint_allows_super_admin_and_removes_user():
    with session_scope() as db:
        super_admin = _make_user(db, role=UserRole.SUPER_ADMIN)
        target = _make_user(db)
        db.commit()
        target_id = target.id

        app = _build_app(db, super_admin)
        client = TestClient(app)
        resp = client.delete(f"/api/v1/admin/users/{target_id}")

        assert resp.status_code == 204
        assert db.query(User).filter(User.id == target_id).first() is None

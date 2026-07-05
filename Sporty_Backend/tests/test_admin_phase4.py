from __future__ import annotations

import os
import sys
import tempfile
import uuid
from contextlib import contextmanager
from pathlib import Path

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_temp_dir = tempfile.mkdtemp(prefix="sporty-admin-phase4-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'admin_phase4.db'}"
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
from app.support import services as support_services
from app.support.models import TicketCategory, TicketPriority, TicketStatus
from app.support.router import router as support_router
from app.support.schemas import TicketCreateRequest

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
    app.include_router(support_router, prefix="/api/v1")

    def _override_get_db():
        yield db

    def _override_current_user():
        return user

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_active_user] = _override_current_user
    return app


# ── Full lifecycle ────────────────────────────────────────────────────────────────

def test_ticket_full_lifecycle():
    with session_scope() as db:
        reporter = _make_user(db, role=UserRole.USER)
        support_admin = _make_user(db, role=UserRole.SUPPORT)
        db.commit()

        # 1. User creates a ticket
        ticket = support_services.create_ticket(
            db, reporter,
            TicketCreateRequest(subject="Can't join league", category=TicketCategory.LEAGUE_DISPUTE, body="Invite code rejected"),
        )
        db.commit()
        assert ticket.status == TicketStatus.OPEN

        # 2. Admin assigns it to themselves
        ticket = admin_services.update_ticket_admin(
            db, support_admin, ticket.id, assigned_admin_user_id=support_admin.id,
        )
        assert ticket.assigned_admin_user_id == support_admin.id

        # 3. Admin posts an internal note
        admin_services.add_ticket_message_admin(
            db, support_admin, ticket.id, "checking league config", is_internal_note=True,
        )

        # 4. Reporter's own view must NOT see the internal note
        reporter_messages = support_services.list_messages(db, ticket.id, include_internal=False)
        assert all(not m.is_internal_note for m in reporter_messages)
        assert len(reporter_messages) == 1  # only the original ticket body

        # Admin's view DOES see it
        admin_messages = support_services.list_messages(db, ticket.id, include_internal=True)
        assert any(m.is_internal_note for m in admin_messages)
        assert len(admin_messages) == 2

        # 5. Admin resolves the ticket
        ticket = admin_services.update_ticket_admin(db, support_admin, ticket.id, new_status=TicketStatus.RESOLVED)
        assert ticket.status == TicketStatus.RESOLVED
        assert ticket.resolved_at is not None

        # 6. Audit log has a TICKET_RESOLVE entry
        entry = (
            db.query(AdminAuditLog)
            .filter(AdminAuditLog.action == AdminActionType.TICKET_RESOLVE)
            .filter(AdminAuditLog.target_id == str(ticket.id))
            .first()
        )
        assert entry is not None
        assert entry.actor_user_id == support_admin.id


def test_reporter_cannot_see_or_reach_another_users_ticket():
    with session_scope() as db:
        reporter = _make_user(db)
        stranger = _make_user(db)
        db.commit()

        ticket = support_services.create_ticket(
            db, reporter, TicketCreateRequest(subject="Billing issue", category=TicketCategory.BILLING, body="charged twice"),
        )
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            support_services.get_my_ticket(db, stranger, ticket.id)
        assert exc_info.value.status_code == 404


def test_list_tickets_admin_filters_by_status():
    with session_scope() as db:
        reporter = _make_user(db)
        db.commit()
        t1 = support_services.create_ticket(db, reporter, TicketCreateRequest(subject="A", category=TicketCategory.BUG, body="x"))
        t2 = support_services.create_ticket(db, reporter, TicketCreateRequest(subject="B", category=TicketCategory.BUG, body="y"))
        db.commit()
        t2.status = TicketStatus.CLOSED
        db.commit()

        rows, total = admin_services.list_tickets_admin(db, page=1, page_size=20, status_filter=TicketStatus.OPEN)
        assert total == 1
        assert rows[0][0].id == t1.id


# ── Router-level tier gating ──────────────────────────────────────────────────────

def test_support_tier_can_fully_operate_tickets():
    with session_scope() as db:
        reporter = _make_user(db)
        support_admin = _make_user(db, role=UserRole.SUPPORT)
        db.commit()
        ticket = support_services.create_ticket(db, reporter, TicketCreateRequest(subject="X", category=TicketCategory.OTHER, body="y"))
        db.commit()

        app = _build_app(db, support_admin)
        client = TestClient(app)

        resp = client.get("/api/v1/admin/tickets")
        assert resp.status_code == 200

        resp = client.patch(f"/api/v1/admin/tickets/{ticket.id}", json={"status": "in_progress"})
        assert resp.status_code == 200

        resp = client.post(f"/api/v1/admin/tickets/{ticket.id}/messages", json={"body": "looking into it", "is_internal_note": True})
        assert resp.status_code == 200


def test_support_tier_403s_on_admin_tier_actions():
    with session_scope() as db:
        support_admin = _make_user(db, role=UserRole.SUPPORT)
        db.commit()
        app = _build_app(db, support_admin)
        client = TestClient(app)

        resp = client.get("/api/v1/admin/users")
        assert resp.status_code == 403

        resp = client.post("/api/v1/admin/scoring/recalculate-active", json={})
        assert resp.status_code == 403


def test_user_facing_ticket_endpoints_work_end_to_end():
    with session_scope() as db:
        reporter = _make_user(db)
        db.commit()
        app = _build_app(db, reporter)
        client = TestClient(app)

        resp = client.post(
            "/api/v1/support/tickets",
            json={"subject": "Help", "category": "account", "body": "forgot my team name"},
        )
        assert resp.status_code == 200
        ticket_id = resp.json()["id"]

        resp = client.get("/api/v1/support/tickets")
        assert resp.status_code == 200
        assert resp.json()["total"] == 1

        resp = client.get(f"/api/v1/support/tickets/{ticket_id}")
        assert resp.status_code == 200
        assert len(resp.json()["messages"]) == 1

        resp = client.post(f"/api/v1/support/tickets/{ticket_id}/messages", json={"body": "any update?"})
        assert resp.status_code == 200

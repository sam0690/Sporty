"""Pins the C2 fix (PHASE1_AUDIT.md): emails are lowercased at every write.

register/google-auth used to store emails as submitted while login and
forgot-password compared lowercased — a mixed-case registration could never
log in by email. These tests fail if _normalize_email() is ever dropped from
any of the write paths.
"""

from __future__ import annotations

import os
import sys
import tempfile
from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_temp_dir = tempfile.mkdtemp(prefix="sporty-email-norm-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'auth.db'}"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["JWT_SECRET_KEY"] = "x" * 32
os.environ["GOOGLE_CLIENT_ID"] = "test-client"

_backend_root = Path(__file__).resolve().parents[1]
os.chdir(_temp_dir)
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from app.auth import services as auth_services
from app.auth.models import User
from app.auth.schemas import GoogleAuthRequest, LoginRequest, RegisterRequest
from app.database import Base
# Model modules needed so SQLAlchemy can resolve the full relationship graph
# reachable from User (same convention as the import block in app/main.py).
from app.ingestion.models import IngestionPlayer  # noqa: F401
from app.league.models import Sport  # noqa: F401
from app.league_chat.models import LeagueChatMessage  # noqa: F401
from app.match.models import Match  # noqa: F401
from app.notification.models import Notification  # noqa: F401
from app.player.models import UserFavouriteTeam  # noqa: F401
from app.player.models_nba import NBAStat  # noqa: F401
from app.scoring.models import DefaultScoringRule  # noqa: F401
from app.support.models import SupportTicket  # noqa: F401

ENGINE = create_engine(os.environ["DATABASE_URL"])
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=ENGINE)

MIXED = "John.Doe@GMAIL.com"
LOWER = "john.doe@gmail.com"


@contextmanager
def session_scope():
    Base.metadata.drop_all(bind=ENGINE)
    Base.metadata.create_all(bind=ENGINE)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_register_stores_lowercased_email():
    with session_scope() as db:
        auth_services.register(
            db, RegisterRequest(username="johndoe", email=MIXED, password="password123")
        )
        user = db.query(User).filter(User.username == "johndoe").one()
        assert user.email == LOWER


def test_mixed_case_registration_can_login_by_email(monkeypatch):
    with session_scope() as db:
        monkeypatch.setattr(auth_services, "_is_login_rate_limited", lambda _: False)
        auth_services.register(
            db, RegisterRequest(username="johndoe", email=MIXED, password="password123")
        )
        tokens = auth_services.login(
            db, LoginRequest(identifier="JOHN.DOE@gmail.COM", password="password123")
        )
        assert tokens.access_token


def test_google_signup_stores_lowercased_email(monkeypatch):
    with session_scope() as db:
        monkeypatch.setattr(
            auth_services, "_exchange_google_authorization_code", lambda code: "id-token"
        )
        monkeypatch.setattr(
            auth_services,
            "verify_google_id_token",
            lambda token: SimpleNamespace(
                sub="google-sub-mixed",
                email=MIXED,
                picture=None,
                name="John Doe",
            ),
        )
        auth_services.google_auth(db, GoogleAuthRequest(code="auth-code"))
        user = db.query(User).filter(User.google_id == "google-sub-mixed").one()
        assert user.email == LOWER

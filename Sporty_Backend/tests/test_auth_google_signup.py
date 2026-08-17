from __future__ import annotations

import os
import sys
import tempfile
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_temp_dir = tempfile.mkdtemp(prefix="sporty-auth-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'auth.db'}"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["JWT_SECRET_KEY"] = "x" * 32
os.environ["GOOGLE_CLIENT_ID"] = "test-client"

_backend_root = Path(__file__).resolve().parents[1]
os.chdir(_temp_dir)
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from app.auth import services as auth_services
from app.auth.models import AuthProvider, RefreshToken, User
from app.auth.schemas import GoogleAuthRequest, RegisterRequest
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


@contextmanager
def session_scope():
    Base.metadata.drop_all(bind=ENGINE)
    Base.metadata.create_all(bind=ENGINE)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_google_auth_creates_active_user_and_tokens(monkeypatch):
    with session_scope() as db:
        monkeypatch.setattr(auth_services, "_exchange_google_authorization_code", lambda code: "id-token")
        monkeypatch.setattr(
            auth_services,
            "verify_google_id_token",
            lambda token: SimpleNamespace(
                sub="google-sub-123",
                email="new-user@example.com",
                picture="https://example.com/avatar.png",
                name="New User",
            ),
        )

        result = auth_services.google_auth(db, GoogleAuthRequest(code="auth-code"))

        assert result.access_token
        assert result.refresh_token

        user = db.query(User).one()
        assert user.auth_provider == AuthProvider.GOOGLE
        assert user.google_id == "google-sub-123"
        assert user.is_active is True
        assert user.id is not None

        token = db.query(RefreshToken).one()
        assert token.user_id == user.id


def test_register_marks_new_local_user_active():
    with session_scope() as db:
        result = auth_services.register(
            db,
            RegisterRequest(
                username="local-user",
                email="local-user@example.com",
                password="super-secret-password",
                auto_login=False,
            ),
        )

        assert result["is_active"] is True

        user = db.query(User).one()
        assert user.auth_provider == AuthProvider.LOCAL
        assert user.is_active is True


def test_build_tokens_prunes_only_this_users_expired_tokens():
    with session_scope() as db:
        for name in ("keeper", "bystander"):
            auth_services.register(
                db,
                RegisterRequest(
                    username=name,
                    email=f"{name}@example.com",
                    password="super-secret-password",
                    auto_login=False,
                ),
            )
        user, other = db.query(User).order_by(User.username).all()

        now = datetime.now(timezone.utc)
        expired, _ = RefreshToken.create_for_user(user.id)
        expired.expires_at = now - timedelta(days=1)
        # Inside the grace window: lapsed, but still the token a client may be
        # about to present, so it must survive this prune.
        just_expired, _ = RefreshToken.create_for_user(user.id)
        just_expired.expires_at = now - (auth_services.EXPIRED_TOKEN_GRACE / 2)
        live, _ = RefreshToken.create_for_user(user.id)
        live.expires_at = now + timedelta(days=7)
        # Another user's dead row must survive: the prune is per-user.
        theirs, _ = RefreshToken.create_for_user(other.id)
        theirs.expires_at = now - timedelta(days=1)
        db.add_all([expired, just_expired, live, theirs])
        db.flush()

        auth_services._build_tokens(db, user)
        db.flush()

        remaining = {t.token_hash for t in db.query(RefreshToken).all()}
        assert expired.token_hash not in remaining
        assert just_expired.token_hash in remaining
        assert live.token_hash in remaining
        assert theirs.token_hash in remaining
        # The freshly issued one, plus the live and just-expired ones we kept.
        assert db.query(RefreshToken).filter(RefreshToken.user_id == user.id).count() == 3

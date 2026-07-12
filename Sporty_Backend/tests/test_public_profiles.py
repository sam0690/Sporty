"""Public (no-auth) player and manager profile endpoints — added for
shareable /p/[id] and /u/[id] frontend pages. The whole point is that these
work with NO Authorization/cookie at all, so these tests deliberately never
override get_current_active_user (unlike every other router test in this
repo) to prove the routes are genuinely unauthenticated."""
from __future__ import annotations

import os
import sys
import tempfile
import uuid
from contextlib import contextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_temp_dir = tempfile.mkdtemp(prefix="sporty-public-profile-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'pub.db'}"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["JWT_SECRET_KEY"] = "x" * 32
os.environ["GOOGLE_CLIENT_ID"] = "test-client"

_backend_root = Path(__file__).resolve().parents[1]
os.chdir(_temp_dir)
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from app.database import Base, get_db  # noqa: E402
from app.auth.models import AuthProvider, User  # noqa: E402
import app.match.models  # noqa: F401,E402
import app.league.models  # noqa: F401,E402
from app.player.models import Player, RealTeam  # noqa: E402
import app.player.models_nba  # noqa: F401,E402
from app.player.router import router as player_router  # noqa: E402
from app.user.router import router as user_router  # noqa: E402
from decimal import Decimal  # noqa: E402

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


def _build_app(db, *, players=True, users=True) -> FastAPI:
    app = FastAPI()
    if players:
        app.include_router(player_router, prefix="/api/v1")
    if users:
        app.include_router(user_router, prefix="/api/v1")

    def _override_get_db():
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    # Deliberately NOT overriding get_current_active_user — a real
    # unauthenticated FastAPI dependency call would 401 if these routes
    # required it, proving they don't.
    return app


def test_public_player_endpoint_works_without_auth():
    with session_scope() as db:
        from app.league.models import Sport

        sport = Sport(name="football", display_name="Football")
        db.add(sport)
        db.flush()
        rt = RealTeam(sport_id=sport.id, name="Test FC", external_api_id=f"rt:{uuid.uuid4().hex[:8]}")
        db.add(rt)
        db.flush()
        player = Player(
            sport_id=sport.id, external_api_id=f"p:{uuid.uuid4().hex[:10]}",
            name="Public Player", position="MID", real_team=rt.name, real_team_id=rt.id,
            cost=Decimal("7.5"), is_available=True,
        )
        db.add(player)
        db.commit()

        app = _build_app(db, users=False)
        client = TestClient(app)

        resp = client.get(f"/api/v1/players/public/{player.id}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Public Player"

        resp = client.get(f"/api/v1/players/public/{player.id}/recent-stats")
        assert resp.status_code == 200
        assert resp.json()["items"] == []


def test_public_player_endpoint_404_for_missing_player():
    with session_scope() as db:
        app = _build_app(db, users=False)
        client = TestClient(app)
        resp = client.get(f"/api/v1/players/public/{uuid.uuid4()}")
        assert resp.status_code == 404


def test_public_manager_stats_works_without_auth_and_excludes_email():
    with session_scope() as db:
        user = User(
            username="pubmanager", email="pubmanager@example.com",
            auth_provider=AuthProvider.LOCAL, password_hash="h",
        )
        db.add(user)
        db.commit()

        app = _build_app(db, players=False)
        client = TestClient(app)

        resp = client.get(f"/api/v1/users/public/{user.id}/stats")
        assert resp.status_code == 200
        body = resp.json()
        assert body["username"] == "pubmanager"
        assert body["total_leagues"] == 0
        # Never leak email on a no-auth route.
        assert "email" not in body


def test_public_manager_stats_404_for_missing_user():
    with session_scope() as db:
        app = _build_app(db, players=False)
        client = TestClient(app)
        resp = client.get(f"/api/v1/users/public/{uuid.uuid4()}/stats")
        assert resp.status_code == 404

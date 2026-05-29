from __future__ import annotations

import os
import sys
import tempfile
import uuid
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from decimal import Decimal

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_temp_dir = tempfile.mkdtemp(prefix="sporty-autopick-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'autopick.db'}"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["JWT_SECRET_KEY"] = "x" * 32
os.environ["GOOGLE_CLIENT_ID"] = "test-client"

_backend_root = Path(__file__).resolve().parents[1]
os.chdir(_temp_dir)
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from app.database import Base, get_db
from app.auth.dependencies import get_current_active_user
from app.auth.models import AuthProvider, User
import app.match.models  # noqa: F401
import app.league.models  # noqa: F401
import app.player.models  # noqa: F401
import app.player.models_nba  # noqa: F401
from app.league import dependencies as league_dependencies
from app.league import router as league_router
from app.league import services as league_service
from app.league.models import League, LeagueSport, Season, Sport, TransferWindow, TeamPlayer
from app.league.schemas import AutoPickRequest, LeagueCreate

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


class _FakeRedis:
    def __init__(self, *, allow_lock: bool = True):
        self.allow_lock = allow_lock
        self.deleted: list[str] = []

    def set(self, key: str, value: str, *, ex: int, nx: bool):
        _ = (key, value, ex, nx)
        return self.allow_lock

    def delete(self, key: str):
        self.deleted.append(key)
        return 1


def _create_user(db, username: str) -> User:
    user = User(
        username=username,
        email=f"{username}@example.com",
        auth_provider=AuthProvider.LOCAL,
        password_hash="hashed-password",
    )
    db.add(user)
    db.flush()
    return user


def _build_app(db, league: League, user: User, fake_redis: _FakeRedis) -> FastAPI:
    app = FastAPI()
    app.include_router(league_router.router, prefix="/api")

    def _override_get_db():
        yield db

    def _override_current_user():
        return user

    def _override_league_member():
        return league

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_active_user] = _override_current_user
    app.dependency_overrides[league_dependencies.require_league_member] = _override_league_member
    league_router.get_redis = lambda: fake_redis
    return app


def _create_mixed_league_with_players(db, owner: User) -> tuple[League, list[uuid.UUID], TransferWindow]:
    football = Sport(name="football", display_name="Football")
    basketball = Sport(name="basketball", display_name="Basketball")
    db.add_all([football, basketball])
    db.flush()

    season = Season(
        sport_id=football.id,
        name=f"Season-{uuid.uuid4().hex[:8]}",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
    )
    db.add(season)
    db.flush()

    league = league_service.create_league(
        db,
        LeagueCreate(
            name=f"League-{uuid.uuid4().hex[:8]}",
            season_id=season.id,
            budget_per_team=Decimal("150"),
            squad_size=15,
            draft_mode=False,
        ),
        owner,
    )
    league_service.add_sport(db, league.id, "basketball")

    now = datetime.now(timezone.utc)
    window = TransferWindow(
        season_id=season.id,
        number=1,
        start_at=now - timedelta(hours=1),
        end_at=now + timedelta(hours=2),
        transfer_deadline_at=now + timedelta(minutes=30),
        lineup_deadline_at=now + timedelta(hours=1),
        transfers_locked=False,
        lineup_locked=False,
    )
    db.add(window)
    db.flush()

    player_ids: list[uuid.UUID] = []
    football_positions = ["GKP", "DEF", "DEF", "MID", "MID", "MID", "FWD", "FWD"]
    football_clubs = ["ClubA", "ClubB", "ClubC", "ClubD", "ClubA", "ClubB", "ClubC", "ClubD"]
    for index, position in enumerate(football_positions, start=1):
        player = app.player.models.Player(  # type: ignore[attr-defined]
            sport_id=football.id,
            name=f"Football {index}",
            position=position,
            real_team=football_clubs[index - 1],
            cost=Decimal(str(5 + index)),
            is_available=True,
        )
        db.add(player)
        db.flush()
        player_ids.append(player.id)

    basketball_positions = ["UNK", "UNK", "UNK", "UNK", "UNK", "UNK", "UNK"]
    basketball_clubs = ["TeamX", "TeamY", "TeamZ", "TeamX", "TeamY", "TeamZ", "TeamX"]
    for index, position in enumerate(basketball_positions, start=1):
        player = app.player.models.Player(  # type: ignore[attr-defined]
            sport_id=basketball.id,
            name=f"Basketball {index}",
            position=position,
            real_team=basketball_clubs[index - 1],
            cost=Decimal(str(4 + index)),
            is_available=True,
        )
        db.add(player)
        db.flush()
        player_ids.append(player.id)

    db.commit()
    db.refresh(league)
    return league, player_ids, window


def test_auto_pick_endpoint_persists_roster_and_snapshots_sport_type() -> None:
    with session_scope() as db:
        owner = _create_user(db, "owner")
        league, player_ids, _window = _create_mixed_league_with_players(db, owner)
        fake_redis = _FakeRedis(allow_lock=True)
        app = _build_app(db, league, owner, fake_redis)

        client = TestClient(app)
        response = client.post(
            f"/api/leagues/{league.id}/auto-pick",
            json={"lockedPlayerIds": [str(player_ids[0])]},
        )

        assert response.status_code == 200
        payload = response.json()
        assert len(payload["players"]) == 15
        assert Decimal(str(payload["totalCost"])) > Decimal("0")
        assert Decimal(str(payload["budgetRemaining"])) >= Decimal("0")
        assert fake_redis.deleted == [f"autopick:lock:{owner.id}:{league.id}"]

        roster = db.query(TeamPlayer).filter(TeamPlayer.fantasy_team_id.isnot(None)).all()
        assert len(roster) == 15
        assert {row.sport_type for row in roster} == {"football", "basketball"}


def test_auto_pick_endpoint_rejects_when_lock_is_held() -> None:
    with session_scope() as db:
        owner = _create_user(db, "owner")
        league, _player_ids, _window = _create_mixed_league_with_players(db, owner)
        fake_redis = _FakeRedis(allow_lock=False)
        app = _build_app(db, league, owner, fake_redis)

        client = TestClient(app)
        response = client.post(f"/api/leagues/{league.id}/auto-pick", json={})

        assert response.status_code == 409
        assert response.json()["detail"] == "Auto-pick is already running"


def test_auto_pick_endpoint_blocks_when_window_locked() -> None:
    with session_scope() as db:
        owner = _create_user(db, "owner")
        league, _player_ids, window = _create_mixed_league_with_players(db, owner)
        window.transfers_locked = True
        db.commit()

        fake_redis = _FakeRedis(allow_lock=True)
        app = _build_app(db, league, owner, fake_redis)

        client = TestClient(app)
        response = client.post(f"/api/leagues/{league.id}/auto-pick", json={})

        assert response.status_code == 403
        assert response.json()["detail"] == "Auto-pick is disabled during the transfer window"

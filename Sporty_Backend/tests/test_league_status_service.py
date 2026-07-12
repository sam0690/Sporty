"""auto_update_league_statuses — commissioner rollover-pending notification.
SQLite throwaway DB, same pattern as test_league_season_rollover.py."""
from __future__ import annotations

import os
import sys
import tempfile
import uuid
from contextlib import contextmanager
from datetime import date, timedelta
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_temp_dir = tempfile.mkdtemp(prefix="sporty-league-status-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'status.db'}"
os.environ["JWT_SECRET_KEY"] = "x" * 32
os.environ["GOOGLE_CLIENT_ID"] = "test-client"

_backend_root = Path(__file__).resolve().parents[1]
os.chdir(_temp_dir)
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from app.database import Base  # noqa: E402
from app.auth.models import AuthProvider, User  # noqa: E402
import app.match.models  # noqa: F401,E402
import app.player.models  # noqa: F401,E402
import app.player.models_nba  # noqa: F401,E402
from app.league import services as league_service  # noqa: E402
from app.league.models import League, LeagueStatus, Season, Sport  # noqa: E402
from app.league.schemas import LeagueCreate  # noqa: E402
from app.notification.models import Notification  # noqa: E402
from app.services.league_status_service import auto_update_league_statuses  # noqa: E402

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


def _user(db, username):
    u = User(username=username, email=f"{username}@e.com",
              auth_provider=AuthProvider.LOCAL, password_hash="h")
    db.add(u)
    db.flush()
    return u


def test_commissioner_gets_rollover_notification_when_league_auto_completes():
    with session_scope() as db:
        owner = _user(db, "owner")
        member = _user(db, "member")
        sport = Sport(name="football", display_name="Football")
        db.add(sport)
        db.flush()

        yesterday = date.today() - timedelta(days=1)
        season = Season(sport_id=sport.id, name=f"S-{uuid.uuid4().hex[:6]}",
                        start_date=yesterday - timedelta(days=200), end_date=yesterday)
        db.add(season)
        db.flush()

        league = league_service.create_league(
            db, LeagueCreate(name="Rollover League", season_id=season.id,
                             draft_mode=False, sports=["football"]), owner)
        db.flush()
        league_service.join_league(db, league.invite_code, member)
        league.status = LeagueStatus.ACTIVE
        league.end_date = yesterday
        db.flush()

        stats = auto_update_league_statuses(db)

        assert stats["active_to_completed"] == 1
        assert stats["rollover_notifications"] == 1

        refreshed = db.query(League).filter(League.id == league.id).first()
        assert refreshed.status == LeagueStatus.COMPLETED

        owner_notifications = db.query(Notification).filter(
            Notification.user_id == owner.id, Notification.league_id == league.id,
        ).all()
        assert any("start next season" in n.message.lower() for n in owner_notifications)

        # Only the commissioner gets the rollover nudge — not every member
        # (they can't act on it; notify_league_completed already told them
        # the season ended).
        member_rollover_notifications = [
            n for n in db.query(Notification).filter(
                Notification.user_id == member.id, Notification.league_id == league.id,
            ).all()
            if "start next season" in n.message.lower()
        ]
        assert member_rollover_notifications == []

"""auto_update_league_statuses — commissioner rollover-pending notification.
SQLite throwaway DB, same pattern as test_league_season_rollover.py."""
from __future__ import annotations

import os
import sys
import tempfile
import uuid
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
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
from fastapi import HTTPException  # noqa: E402
import app.match.models  # noqa: F401,E402
import app.player.models  # noqa: F401,E402
import app.player.models_nba  # noqa: F401,E402
from app.league import services as league_service  # noqa: E402
from app.league.models import League, LeagueStatus, Season, Sport, TransferWindow  # noqa: E402
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


def _setup_league_ready_to_activate(db, *, with_windows: bool):
    """A budget-mode SETUP league, 2 active members, season already started —
    everything the SETUP->ACTIVE transition needs except (optionally)
    transfer windows."""
    owner = _user(db, f"owner-{uuid.uuid4().hex[:6]}")
    member = _user(db, f"member-{uuid.uuid4().hex[:6]}")
    sport = Sport(name="football", display_name="Football")
    db.add(sport)
    db.flush()

    today = date.today()
    season = Season(sport_id=sport.id, name=f"S-{uuid.uuid4().hex[:6]}",
                    start_date=today - timedelta(days=1), end_date=today + timedelta(days=200))
    db.add(season)
    db.flush()

    league = league_service.create_league(
        db, LeagueCreate(name="Activation League", season_id=season.id,
                         draft_mode=False, sports=["football"]), owner)
    db.flush()
    league_service.join_league(db, league.invite_code, member)
    league.start_date = today - timedelta(days=1)
    db.flush()

    if with_windows:
        start_at = datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)
        db.add(TransferWindow(
            season_id=season.id, number=1,
            start_at=start_at, end_at=start_at + timedelta(hours=23, minutes=59),
            transfer_deadline_at=start_at, lineup_deadline_at=start_at + timedelta(minutes=1),
        ))
        db.flush()

    return owner, league


def test_auto_update_league_statuses_skips_setup_league_with_no_transfer_windows():
    with session_scope() as db:
        _owner, league = _setup_league_ready_to_activate(db, with_windows=False)

        stats = auto_update_league_statuses(db)

        assert stats["setup_to_active"] == 0
        assert stats["setup_skipped_no_windows"] == 1

        refreshed = db.query(League).filter(League.id == league.id).first()
        assert refreshed.status == LeagueStatus.SETUP


def test_auto_update_league_statuses_activates_setup_league_with_transfer_windows():
    with session_scope() as db:
        _owner, league = _setup_league_ready_to_activate(db, with_windows=True)

        stats = auto_update_league_statuses(db)

        assert stats["setup_to_active"] == 1
        assert stats["setup_skipped_no_windows"] == 0

        refreshed = db.query(League).filter(League.id == league.id).first()
        assert refreshed.status == LeagueStatus.ACTIVE


def test_update_league_status_rejects_setup_to_active_with_no_transfer_windows():
    with session_scope() as db:
        owner, league = _setup_league_ready_to_activate(db, with_windows=False)

        try:
            league_service.update_league_status(db, league.id, LeagueStatus.ACTIVE, owner)
            assert False, "expected HTTPException"
        except HTTPException as exc:
            assert exc.status_code == 409
            assert "transfer window" in exc.detail.lower()

        refreshed = db.query(League).filter(League.id == league.id).first()
        assert refreshed.status == LeagueStatus.SETUP


def test_update_league_status_allows_setup_to_active_with_transfer_windows():
    with session_scope() as db:
        owner, league = _setup_league_ready_to_activate(db, with_windows=True)

        updated = league_service.update_league_status(db, league.id, LeagueStatus.ACTIVE, owner)
        db.flush()

        assert updated.status == LeagueStatus.ACTIVE

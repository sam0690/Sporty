"""build_initial_team's status gate.

A budget league auto-flips SETUP->ACTIVE on its start date whether or not every
member finished their squad. The gate used to require
membership.eligible_from_window_id — set only by join_league()'s midseason path —
so anyone who joined during SETUP and hadn't built yet was locked out for good.

These tests only assert which status values pass the gate; the squad itself is
deliberately empty so the call fails afterwards on squad-size validation.
"""

from __future__ import annotations

import os
import sys
import tempfile
import uuid
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_temp_dir = tempfile.mkdtemp(prefix="sporty-build-gate-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'build.db'}"
os.environ["JWT_SECRET_KEY"] = "x" * 32
os.environ["GOOGLE_CLIENT_ID"] = "test-client"

_backend_root = Path(__file__).resolve().parents[1]
os.chdir(_temp_dir)
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from app.database import Base
from app.auth.models import AuthProvider, User
import app.match.models  # noqa: F401
import app.player.models  # noqa: F401
import app.player.models_nba  # noqa: F401
from app.league import services as league_service
from app.league.models import LeagueStatus, Season, Sport, TransferWindow
from app.league.schemas import LeagueCreate

ENGINE = create_engine(os.environ["DATABASE_URL"])
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=ENGINE)

STATUS_GATE_DETAIL = "Teams can only be built while the league is in setup or active"


@contextmanager
def session_scope():
    Base.metadata.drop_all(bind=ENGINE)
    Base.metadata.create_all(bind=ENGINE)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _setup(db, status: LeagueStatus):
    """Owner + budget league in `status`, membership left with a NULL
    eligible_from_window_id (i.e. joined during SETUP, never a midseason joiner)."""
    owner = User(
        username="owner",
        email="owner@example.com",
        auth_provider=AuthProvider.LOCAL,
        password_hash="hashed-password",
    )
    db.add(owner)
    db.flush()

    sport = Sport(name="football", display_name="Football")
    db.add(sport)
    db.flush()
    season = Season(
        sport_id=sport.id,
        name=f"Season-{uuid.uuid4().hex[:8]}",
        start_date=date(2026, 8, 1),
        end_date=date(2027, 5, 30),
    )
    db.add(season)
    db.flush()

    league = league_service.create_league(
        db,
        LeagueCreate(
            name=f"League-{uuid.uuid4().hex[:8]}",
            season_id=season.id,
            draft_mode=False,
            sports=["football"],
        ),
        owner,
    )
    league.status = status
    db.flush()
    return league, owner


def _build(db, league, user):
    with pytest.raises(HTTPException) as exc:
        league_service.build_initial_team(db, league.id, "Late FC", [], user)
    return exc.value


@pytest.mark.parametrize("status", [LeagueStatus.SETUP, LeagueStatus.ACTIVE])
def test_setup_and_active_pass_the_status_gate(status) -> None:
    with session_scope() as db:
        league, owner = _setup(db, status)
        # 400 from squad-size validation, not the 409 status gate — i.e. the
        # build was allowed through and only the empty squad stopped it.
        assert _build(db, league, owner).status_code == 400


@pytest.mark.parametrize("status", [LeagueStatus.DRAFTING, LeagueStatus.COMPLETED])
def test_other_statuses_are_still_rejected(status) -> None:
    with session_scope() as db:
        league, owner = _setup(db, status)
        error = _build(db, league, owner)
        assert error.status_code == 409
        assert error.detail == STATUS_GATE_DETAIL


# ── join_league eligibility stamping ────────────────────────────────────────
#
# eligible_from_window_id marks a genuinely late entrant, and standings_service
# hides such a team from the season leaderboard until that window starts. A
# league goes ACTIVE on its start date, which can precede its first window, so
# joins in that gap must NOT be stamped — they missed no scoring.


def _add_windows(db, league, *, first_window_started: bool):
    """Two windows a week apart. When first_window_started, window 1 is in the
    past and window 2 upcoming; otherwise both are upcoming."""
    now = datetime.now(timezone.utc)
    offset = timedelta(days=-3) if first_window_started else timedelta(days=4)
    for number in (1, 2):
        start = now + offset + timedelta(days=7 * (number - 1))
        db.add(
            TransferWindow(
                season_id=league.season_id,
                competition=None,
                number=number,
                start_at=start,
                end_at=start + timedelta(days=6),
                transfer_deadline_at=start,
                lineup_deadline_at=start + timedelta(hours=1),
            )
        )
    db.flush()


def _joiner(db, name: str) -> User:
    user = User(
        username=name,
        email=f"{name}@example.com",
        auth_provider=AuthProvider.LOCAL,
        password_hash="hashed-password",
    )
    db.add(user)
    db.flush()
    return user


def test_join_before_first_window_is_not_a_midseason_joiner() -> None:
    with session_scope() as db:
        league, _ = _setup(db, LeagueStatus.ACTIVE)
        league.allow_midseason_join = True
        _add_windows(db, league, first_window_started=False)

        membership = league_service.join_league(db, league.invite_code, _joiner(db, "early"))

        assert membership.eligible_from_window_id is None


def test_join_after_the_season_started_is_stamped_with_the_next_window() -> None:
    with session_scope() as db:
        league, _ = _setup(db, LeagueStatus.ACTIVE)
        league.allow_midseason_join = True
        _add_windows(db, league, first_window_started=True)

        membership = league_service.join_league(db, league.invite_code, _joiner(db, "late"))

        window = db.query(TransferWindow).filter(
            TransferWindow.id == membership.eligible_from_window_id
        ).one()
        assert window.number == 2

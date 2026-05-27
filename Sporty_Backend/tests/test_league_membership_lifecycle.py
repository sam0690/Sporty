from __future__ import annotations

import os
import tempfile
import uuid
from contextlib import contextmanager
from datetime import date
from datetime import datetime
from datetime import timedelta
from datetime import timezone
from pathlib import Path
import sys
from decimal import Decimal

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_temp_dir = tempfile.mkdtemp(prefix="sporty-league-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'league.db'}"
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
from app.league import dependencies as league_dependencies
from app.league import services as league_service
from app.league.models import (
    FantasyTeam,
    FantasyTeamStatus,
    League,
    LeagueMembership,
    LeagueMembershipStatus,
    LeagueStatus,
    Season,
    Sport,
    TeamWeeklyScore,
    TransferWindow,
)
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


def _create_league(db, owner: User, *, draft_mode: bool = True) -> League:
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

    league = league_service.create_league(
        db,
        LeagueCreate(
            name=f"League-{uuid.uuid4().hex[:8]}",
            season_id=season.id,
            draft_mode=draft_mode,
        ),
        owner,
    )
    return league


def test_join_leave_rejoin_preserves_membership_and_team_state() -> None:
    with session_scope() as db:
        owner = _create_user(db, "owner")
        joiner = _create_user(db, "joiner")
        league = _create_league(db, owner)

        membership = league_service.join_league(db, league.invite_code, joiner)
        team = FantasyTeam(
            league_id=league.id,
            user_id=joiner.id,
            name="Joiner FC",
            current_budget=league.budget_per_team,
            starting_budget=league.budget_per_team,
            starting_squad_size=league.squad_size,
        )
        db.add(team)
        db.flush()

        league_service.leave_league(db, league.id, joiner)
        assert membership.status == LeagueMembershipStatus.LEFT
        assert team.status == FantasyTeamStatus.ARCHIVED

        with pytest.raises(HTTPException):
            league_dependencies.require_league_member(
                league=league,
                current_user=joiner,
                db=db,
            )

        assert league_service.get_leagues_for_user(db, joiner.id) == []

        rejoined = league_service.join_league(db, league.invite_code, joiner)
        assert rejoined.id == membership.id
        assert rejoined.status == LeagueMembershipStatus.ACTIVE
        assert team.status == FantasyTeamStatus.ACTIVE
        assert league_service.get_leagues_for_user(db, joiner.id)[0].id == league.id


def test_start_draft_ignores_left_memberships() -> None:
    with session_scope() as db:
        owner = _create_user(db, "owner")
        active_member = _create_user(db, "active")
        left_member = _create_user(db, "left")
        league = _create_league(db, owner)

        active_membership = league_service.join_league(db, league.invite_code, active_member)
        left_membership = league_service.join_league(db, league.invite_code, left_member)
        left_team = FantasyTeam(
            league_id=league.id,
            user_id=left_member.id,
            name="Left FC",
            current_budget=league.budget_per_team,
            starting_budget=league.budget_per_team,
            starting_squad_size=league.squad_size,
        )
        db.add(left_team)
        db.flush()

        league_service.leave_league(db, league.id, left_member)
        assert left_membership.status == LeagueMembershipStatus.LEFT
        assert left_team.status == FantasyTeamStatus.ARCHIVED

        started = league_service.start_draft(db, league.id, owner)
        assert started.status == LeagueStatus.DRAFTING

        db.expire_all()
        memberships = (
            db.query(LeagueMembership)
            .filter(LeagueMembership.league_id == league.id)
            .order_by(LeagueMembership.joined_at)
            .all()
        )
        active_memberships = [m for m in memberships if m.status == LeagueMembershipStatus.ACTIVE]
        left_memberships = [m for m in memberships if m.status == LeagueMembershipStatus.LEFT]
        assert len(active_memberships) == 2
        assert len(left_memberships) == 1
        assert all(m.draft_position is not None for m in active_memberships)
        assert left_memberships[0].draft_position is None

        teams = (
            db.query(FantasyTeam)
            .filter(FantasyTeam.league_id == league.id)
            .order_by(FantasyTeam.user_id)
            .all()
        )
        assert sum(1 for row in teams if row.status == FantasyTeamStatus.ACTIVE) == 2
        assert sum(1 for row in teams if row.status == FantasyTeamStatus.ARCHIVED) == 1
        assert any(row.user_id == left_member.id and row.status == FantasyTeamStatus.ARCHIVED for row in teams)
        assert active_member.id in {row.user_id for row in teams if row.status == FantasyTeamStatus.ACTIVE}


def test_historical_leaderboard_keeps_left_members() -> None:
    with session_scope() as db:
        owner = _create_user(db, "owner")
        active_member = _create_user(db, "active")
        left_member = _create_user(db, "left")
        league = _create_league(db, owner)

        active_membership = league_service.join_league(db, league.invite_code, active_member)
        left_membership = league_service.join_league(db, league.invite_code, left_member)

        active_team = FantasyTeam(
            league_id=league.id,
            user_id=active_member.id,
            name="Active FC",
            current_budget=league.budget_per_team,
            starting_budget=league.budget_per_team,
            starting_squad_size=league.squad_size,
        )
        left_team = FantasyTeam(
            league_id=league.id,
            user_id=left_member.id,
            name="Left FC",
            current_budget=league.budget_per_team,
            starting_budget=league.budget_per_team,
            starting_squad_size=league.squad_size,
        )
        db.add_all([active_team, left_team])
        db.flush()

        now = datetime.now(timezone.utc)
        end_at = now + timedelta(hours=2)
        window = TransferWindow(
            season_id=league.season_id,
            number=1,
            start_at=now,
            end_at=end_at,
            transfer_deadline_at=now + timedelta(minutes=30),
            lineup_deadline_at=now + timedelta(hours=1),
            transfers_locked=False,
            lineup_locked=False,
        )
        db.add(window)
        db.flush()

        db.add_all(
            [
                TeamWeeklyScore(
                    fantasy_team_id=active_team.id,
                    transfer_window_id=window.id,
                    points=Decimal("12.00"),
                    rank_in_league=1,
                ),
                TeamWeeklyScore(
                    fantasy_team_id=left_team.id,
                    transfer_window_id=window.id,
                    points=Decimal("8.00"),
                    rank_in_league=2,
                ),
            ]
        )
        db.flush()

        league_service.leave_league(db, league.id, left_member)
        assert left_membership.status == LeagueMembershipStatus.LEFT

        live = league_service.get_league_leaderboard(db, league.id, window.id, historical=False)
        historical = league_service.get_league_leaderboard(db, league.id, window.id, historical=True)

        live_team_ids = {entry["team_id"] for entry in live["entries"]}
        historical_team_ids = {entry["team_id"] for entry in historical["entries"]}

        assert active_team.id in live_team_ids
        assert left_team.id not in live_team_ids
        assert active_team.id in historical_team_ids
        assert left_team.id in historical_team_ids


def test_rejoin_rejects_archived_team_when_configuration_is_incompatible() -> None:
    with session_scope() as db:
        owner = _create_user(db, "owner")
        joiner = _create_user(db, "joiner")
        league = _create_league(db, owner)

        membership = league_service.join_league(db, league.invite_code, joiner)
        team = FantasyTeam(
            league_id=league.id,
            user_id=joiner.id,
            name="Joiner FC",
            current_budget=league.budget_per_team,
            starting_budget=league.budget_per_team,
            starting_squad_size=league.squad_size,
        )
        db.add(team)
        db.flush()

        league_service.leave_league(db, league.id, joiner)
        team.starting_budget = league.budget_per_team + Decimal("1.00")
        db.flush()

        with pytest.raises(HTTPException):
            league_service.join_league(db, league.invite_code, joiner)

        db.refresh(membership)
        db.refresh(team)
        assert membership.status == LeagueMembershipStatus.LEFT
        assert team.status == FantasyTeamStatus.ARCHIVED

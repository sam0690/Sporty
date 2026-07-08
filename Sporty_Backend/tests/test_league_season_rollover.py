from __future__ import annotations

import os
import tempfile
import uuid
from contextlib import contextmanager
from datetime import date
from pathlib import Path
import sys

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_temp_dir = tempfile.mkdtemp(prefix="sporty-season-rollover-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'rollover.db'}"
os.environ["JWT_SECRET_KEY"] = "x" * 32
os.environ["GOOGLE_CLIENT_ID"] = "test-client"

_backend_root = Path(__file__).resolve().parents[1]
os.chdir(_temp_dir)
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from datetime import datetime, timezone

from app.database import Base
from app.auth.models import AuthProvider, User
import app.match.models  # noqa: F401
import app.player.models  # noqa: F401
import app.player.models_nba  # noqa: F401
from app.league import services as league_service
from app.league.models import (
    FantasyTeam,
    League,
    LeagueMembershipStatus,
    LeagueSport,
    LeagueStatus,
    LineupSlot,
    RosterMove,
    Season,
    Sport,
    TeamPlayer,
    TeamWeeklyScore,
    TransferWindow,
    WaiverOrder,
)
from app.league.schemas import LeagueCreate
from app.player.models import Player, RealTeam

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


def _create_season(db, sport: Sport, *, start: date, end: date, is_active: bool = True) -> Season:
    season = Season(
        sport_id=sport.id,
        name=f"Season-{uuid.uuid4().hex[:8]}",
        start_date=start,
        end_date=end,
        is_active=is_active,
    )
    db.add(season)
    db.flush()
    return season


def _create_league(db, owner: User, season: Season, *, draft_mode: bool = True) -> League:
    league = league_service.create_league(
        db,
        LeagueCreate(
            name=f"League-{uuid.uuid4().hex[:8]}",
            season_id=season.id,
            draft_mode=draft_mode,
            sports=["football"],
        ),
        owner,
    )
    db.add(LineupSlot(
        league_id=league.id, sport_id=season.sport_id, position="GKP", min_count=1, max_count=1,
    ))
    db.flush()
    return league


def _create_transfer_window(db, season: Season, *, number: int = 1) -> TransferWindow:
    start = datetime(season.start_date.year, season.start_date.month, season.start_date.day, tzinfo=timezone.utc)
    window = TransferWindow(
        season_id=season.id,
        number=number,
        start_at=start,
        end_at=start.replace(hour=23, minute=59),
        transfer_deadline_at=start.replace(hour=12),
        lineup_deadline_at=start.replace(hour=18),
    )
    db.add(window)
    db.flush()
    return window


def _create_player(db, sport: Sport, real_team: RealTeam, *, name: str, cost: int) -> Player:
    player = Player(
        sport_id=sport.id,
        name=name,
        position="GKP",
        real_team="Test FC",
        real_team_id=real_team.id,
        cost=cost,
    )
    db.add(player)
    db.flush()
    return player


def _complete(db, league: League, owner: User) -> None:
    league_service.update_league_status(db, league.id, LeagueStatus.DRAFTING, owner)
    league_service.update_league_status(db, league.id, LeagueStatus.ACTIVE, owner)
    league_service.update_league_status(db, league.id, LeagueStatus.COMPLETED, owner)


def test_renew_league_happy_path() -> None:
    with session_scope() as db:
        sport = Sport(name="football", display_name="Football")
        db.add(sport)
        db.flush()

        owner = _create_user(db, "owner")
        member = _create_user(db, "member")
        left_member = _create_user(db, "left_member")

        season1 = _create_season(db, sport, start=date(2025, 8, 1), end=date(2026, 5, 31))
        league = _create_league(db, owner, season1)

        league_service.join_league(db, league.invite_code, member)
        league_service.join_league(db, league.invite_code, left_member)
        league_service.leave_league(db, league.id, left_member)

        _complete(db, league, owner)

        season2 = _create_season(db, sport, start=date(2026, 8, 1), end=date(2027, 5, 31))

        new_league = league_service.renew_league(db, league.id, None, owner)

        assert new_league.id != league.id
        assert new_league.season_group_id == league.season_group_id == league.id
        assert new_league.season_number == 2
        assert new_league.season_id == season2.id
        assert new_league.status == LeagueStatus.SETUP
        assert new_league.owner_id == owner.id
        assert new_league.draft_mode == league.draft_mode
        assert new_league.invite_code != league.invite_code

        member_ids = {m.user_id for m in new_league.memberships}
        assert member_ids == {owner.id, member.id}
        assert left_member.id not in member_ids

        sport_ids = {ls.sport_id for ls in new_league.sports}
        assert sport_ids == {sport.id}

        new_slots = db.query(LineupSlot).filter(LineupSlot.league_id == new_league.id).all()
        assert len(new_slots) == 1
        assert new_slots[0].position == "GKP"

        assert db.query(FantasyTeam).filter(FantasyTeam.league_id == new_league.id).count() == 0

        history = league_service.get_season_history(db, league.id)
        assert [l.season_number for l in history] == [1, 2]


def test_renew_rejects_non_completed_league() -> None:
    with session_scope() as db:
        sport = Sport(name="football", display_name="Football")
        db.add(sport)
        db.flush()
        owner = _create_user(db, "owner")
        season = _create_season(db, sport, start=date(2025, 8, 1), end=date(2026, 5, 31))
        league = _create_league(db, owner, season)

        with pytest.raises(HTTPException) as exc:
            league_service.renew_league(db, league.id, None, owner)
        assert exc.value.status_code == 409


def test_renew_rejects_duplicate_renewal() -> None:
    with session_scope() as db:
        sport = Sport(name="football", display_name="Football")
        db.add(sport)
        db.flush()
        owner = _create_user(db, "owner")
        season1 = _create_season(db, sport, start=date(2025, 8, 1), end=date(2026, 5, 31))
        league = _create_league(db, owner, season1)
        _complete(db, league, owner)

        season2 = _create_season(db, sport, start=date(2026, 8, 1), end=date(2027, 5, 31))
        league_service.renew_league(db, league.id, None, owner)

        with pytest.raises(HTTPException) as exc:
            league_service.renew_league(db, league.id, None, owner)
        assert exc.value.status_code == 409


def test_renew_rejects_when_no_next_season_available() -> None:
    with session_scope() as db:
        sport = Sport(name="football", display_name="Football")
        db.add(sport)
        db.flush()
        owner = _create_user(db, "owner")
        season = _create_season(db, sport, start=date(2025, 8, 1), end=date(2026, 5, 31))
        league = _create_league(db, owner, season)
        _complete(db, league, owner)

        with pytest.raises(HTTPException) as exc:
            league_service.renew_league(db, league.id, None, owner)
        assert exc.value.status_code == 409


def test_renew_rejects_overlapping_target_season() -> None:
    with session_scope() as db:
        sport = Sport(name="football", display_name="Football")
        db.add(sport)
        db.flush()
        owner = _create_user(db, "owner")
        season1 = _create_season(db, sport, start=date(2025, 8, 1), end=date(2026, 5, 31))
        league = _create_league(db, owner, season1)
        _complete(db, league, owner)

        overlapping_season = _create_season(
            db, sport, start=date(2026, 3, 1), end=date(2027, 3, 1)
        )

        with pytest.raises(HTTPException) as exc:
            league_service.renew_league(db, league.id, overlapping_season.id, owner)
        assert exc.value.status_code == 409


def test_renew_rejects_non_owner() -> None:
    with session_scope() as db:
        sport = Sport(name="football", display_name="Football")
        db.add(sport)
        db.flush()
        owner = _create_user(db, "owner")
        other = _create_user(db, "other")
        season1 = _create_season(db, sport, start=date(2025, 8, 1), end=date(2026, 5, 31))
        league = _create_league(db, owner, season1)
        _complete(db, league, owner)
        _create_season(db, sport, start=date(2026, 8, 1), end=date(2027, 5, 31))

        with pytest.raises(HTTPException) as exc:
            league_service.renew_league(db, league.id, None, other)
        assert exc.value.status_code == 403


def test_renew_league_dynasty_carryover_draft_mode() -> None:
    with session_scope() as db:
        sport = Sport(name="football", display_name="Football")
        db.add(sport)
        db.flush()
        real_team = RealTeam(sport_id=sport.id, name="Test FC")
        db.add(real_team)
        db.flush()

        owner = _create_user(db, "owner")
        member = _create_user(db, "member")

        season1 = _create_season(db, sport, start=date(2025, 8, 1), end=date(2026, 5, 31))
        league = _create_league(db, owner, season1, draft_mode=True)
        league_service.join_league(db, league.invite_code, member)

        window1 = _create_transfer_window(db, season1, number=1)

        owner_team = FantasyTeam(
            league_id=league.id, user_id=owner.id, name="Owner Team",
            current_budget=100, starting_budget=100, starting_squad_size=1,
        )
        member_team = FantasyTeam(
            league_id=league.id, user_id=member.id, name="Member Team",
            current_budget=100, starting_budget=100, starting_squad_size=1,
        )
        db.add_all([owner_team, member_team])
        db.flush()

        owner_player = _create_player(db, sport, real_team, name="Owner Keeper", cost=10)
        member_player = _create_player(db, sport, real_team, name="Member Keeper", cost=8)

        db.add(TeamPlayer(
            fantasy_team_id=owner_team.id, league_id=league.id, is_draft=True,
            player_id=owner_player.id, sport_type="football",
            acquired_window_id=window1.id, cost_at_acquisition=10,
        ))
        db.add(TeamPlayer(
            fantasy_team_id=member_team.id, league_id=league.id, is_draft=True,
            player_id=member_player.id, sport_type="football",
            acquired_window_id=window1.id, cost_at_acquisition=8,
        ))
        db.flush()

        # Owner finished 1st (more points), member finished last — dynasty
        # waiver order should reverse this (member picks first next season).
        db.add(TeamWeeklyScore(fantasy_team_id=owner_team.id, transfer_window_id=window1.id, points=50))
        db.add(TeamWeeklyScore(fantasy_team_id=member_team.id, transfer_window_id=window1.id, points=10))
        db.flush()

        _complete(db, league, owner)

        season2 = _create_season(db, sport, start=date(2026, 8, 1), end=date(2027, 5, 31))
        _create_transfer_window(db, season2, number=1)

        new_league = league_service.renew_league(db, league.id, None, owner, dynasty=True)

        assert new_league.status == LeagueStatus.ACTIVE

        new_teams = {
            t.user_id: t
            for t in db.query(FantasyTeam).filter(FantasyTeam.league_id == new_league.id).all()
        }
        assert set(new_teams) == {owner.id, member.id}

        new_owner_players = db.query(TeamPlayer).filter(
            TeamPlayer.fantasy_team_id == new_teams[owner.id].id,
            TeamPlayer.released_window_id.is_(None),
        ).all()
        assert {tp.player_id for tp in new_owner_players} == {owner_player.id}
        assert new_owner_players[0].is_draft is True

        moves = db.query(RosterMove).filter(RosterMove.league_id == new_league.id).all()
        assert len(moves) == 2
        assert {m.move_type for m in moves} == {"dynasty_carryover"}
        assert {m.add_player_id for m in moves} == {owner_player.id, member_player.id}

        waiver_rows = (
            db.query(WaiverOrder)
            .filter(WaiverOrder.league_id == new_league.id)
            .order_by(WaiverOrder.position)
            .all()
        )
        assert len(waiver_rows) == 2
        assert waiver_rows[0].fantasy_team_id == new_teams[member.id].id  # worst finisher picks first
        assert waiver_rows[1].fantasy_team_id == new_teams[owner.id].id

        # Draft-mode ownership stays exclusive in the new league too.
        new_all_players = db.query(TeamPlayer).filter(
            TeamPlayer.league_id == new_league.id,
            TeamPlayer.released_window_id.is_(None),
        ).all()
        assert len({tp.player_id for tp in new_all_players}) == len(new_all_players)


def test_renew_league_dynasty_budget_mode_allows_negative_budget() -> None:
    with session_scope() as db:
        sport = Sport(name="football", display_name="Football")
        db.add(sport)
        db.flush()
        real_team = RealTeam(sport_id=sport.id, name="Test FC")
        db.add(real_team)
        db.flush()

        owner = _create_user(db, "owner")
        member = _create_user(db, "member")

        season1 = _create_season(db, sport, start=date(2025, 8, 1), end=date(2026, 5, 31))
        league = _create_league(db, owner, season1, draft_mode=False)
        league_service.join_league(db, league.invite_code, member)
        window1 = _create_transfer_window(db, season1, number=1)

        owner_team = FantasyTeam(
            league_id=league.id, user_id=owner.id, name="Owner Team",
            current_budget=0, starting_budget=league.budget_per_team, starting_squad_size=1,
        )
        member_team = FantasyTeam(
            league_id=league.id, user_id=member.id, name="Member Team",
            current_budget=league.budget_per_team, starting_budget=league.budget_per_team,
            starting_squad_size=1,
        )
        db.add_all([owner_team, member_team])
        db.flush()

        # Price drifted well above the league's budget_per_team since last season.
        expensive_player = _create_player(
            db, sport, real_team, name="Star Player", cost=int(league.budget_per_team) + 50,
        )
        db.add(TeamPlayer(
            fantasy_team_id=owner_team.id, league_id=league.id, is_draft=False,
            player_id=expensive_player.id, sport_type="football",
            acquired_window_id=window1.id, cost_at_acquisition=expensive_player.cost,
        ))
        db.flush()

        league_service.update_league_status(db, league.id, LeagueStatus.ACTIVE, owner)
        league_service.update_league_status(db, league.id, LeagueStatus.COMPLETED, owner)

        season2 = _create_season(db, sport, start=date(2026, 8, 1), end=date(2027, 5, 31))
        _create_transfer_window(db, season2, number=1)

        new_league = league_service.renew_league(db, league.id, None, owner, dynasty=True)
        db.flush()  # would raise IntegrityError here if the DB still enforced current_budget >= 0

        new_team = (
            db.query(FantasyTeam)
            .filter(FantasyTeam.league_id == new_league.id, FantasyTeam.user_id == owner.id)
            .first()
        )
        assert new_team.current_budget == new_league.budget_per_team - expensive_player.cost
        assert new_team.current_budget < 0

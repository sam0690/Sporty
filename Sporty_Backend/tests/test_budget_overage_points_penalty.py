from __future__ import annotations

import os
import tempfile
import uuid
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
import sys

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_temp_dir = tempfile.mkdtemp(prefix="sporty-points-penalty-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'penalty.db'}"
os.environ["JWT_SECRET_KEY"] = "x" * 32
os.environ["GOOGLE_CLIENT_ID"] = "test-client"

_backend_root = Path(__file__).resolve().parents[1]
os.chdir(_temp_dir)
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from app.database import Base
from app.auth.models import AuthProvider, User
import app.match.models  # noqa: F401
import app.player.models_nba  # noqa: F401
from app.core.config import settings
from app.league import services as league_service
from app.services import transfer_service
from app.services.scoring import ranking
from app.league.models import (
    FantasyTeam,
    League,
    LeagueStatus,
    LineupSlot,
    PointsPenalty,
    Season,
    Sport,
    TeamPlayer,
    TeamWeeklyScore,
    TransferWindow,
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


def _create_season(db, sport: Sport) -> Season:
    season = Season(
        sport_id=sport.id,
        name=f"Season-{uuid.uuid4().hex[:8]}",
        start_date=date(2025, 8, 1),
        end_date=date(2026, 5, 31),
        is_active=True,
    )
    db.add(season)
    db.flush()
    return season


def _create_budget_league(db, owner: User, season: Season, *, budget_per_team: Decimal) -> League:
    league = league_service.create_league(
        db,
        LeagueCreate(
            name=f"League-{uuid.uuid4().hex[:8]}",
            season_id=season.id,
            draft_mode=False,
            budget_per_team=budget_per_team,
            allow_midseason_join=True,
            sports=["football"],
        ),
        owner,
    )
    db.add(LineupSlot(
        league_id=league.id, sport_id=season.sport_id, position="GKP", min_count=1, max_count=1,
    ))
    league.status = LeagueStatus.ACTIVE
    db.flush()
    return league


def _create_transfer_window(db, season: Season, *, number: int, past: bool) -> TransferWindow:
    anchor = datetime.now(timezone.utc) + (timedelta(days=-7) if past else timedelta(days=7))
    window = TransferWindow(
        season_id=season.id,
        number=number,
        start_at=anchor,
        end_at=anchor + timedelta(days=6),
        transfer_deadline_at=anchor + timedelta(hours=1),
        lineup_deadline_at=anchor + timedelta(hours=2),
    )
    db.add(window)
    db.flush()
    return window


def _create_player(db, sport: Sport, real_team: RealTeam, *, name: str, cost: int) -> Player:
    player = Player(
        sport_id=sport.id, name=name, position="GKP", real_team="Test FC",
        real_team_id=real_team.id, cost=cost,
    )
    db.add(player)
    db.flush()
    return player


def _setup_league_with_team(db, *, budget_per_team: Decimal = Decimal("103.00")):
    sport = Sport(name="football", display_name="Football")
    db.add(sport)
    db.flush()
    real_team = RealTeam(sport_id=sport.id, name="Test FC")
    db.add(real_team)
    db.flush()

    owner = _create_user(db, "owner")
    season = _create_season(db, sport)
    league = _create_budget_league(db, owner, season, budget_per_team=budget_per_team)

    past_window = _create_transfer_window(db, season, number=1, past=True)
    future_window = _create_transfer_window(db, season, number=2, past=False)

    team = FantasyTeam(
        league_id=league.id, user_id=owner.id, name="Owner Team",
        current_budget=Decimal("2.00"), starting_budget=budget_per_team, starting_squad_size=1,
    )
    db.add(team)
    db.flush()

    player_out = _create_player(db, sport, real_team, name="Cheap Keeper", cost=1)
    db.add(TeamPlayer(
        fantasy_team_id=team.id, league_id=league.id, is_draft=False,
        player_id=player_out.id, sport_type="football",
        acquired_window_id=past_window.id, cost_at_acquisition=1,
    ))
    db.flush()

    return sport, real_team, owner, league, team, player_out, past_window, future_window


def test_make_transfer_blocks_without_flag_when_over_budget() -> None:
    with session_scope() as db:
        sport, real_team, owner, league, team, player_out, _, _fw = _setup_league_with_team(db)
        expensive = _create_player(db, sport, real_team, name="Star Keeper", cost=50)

        with pytest.raises(HTTPException) as exc:
            league_service.make_transfer(db, league.id, player_out.id, expensive.id, owner)

        assert exc.value.status_code == 409
        assert exc.value.detail["error"] == "insufficient_budget"
        assert "points_cost" in exc.value.detail


def test_make_transfer_charges_points_when_flag_set_and_affordable() -> None:
    with session_scope() as db:
        sport, real_team, owner, league, team, player_out, past_window, future_window = _setup_league_with_team(db)
        expensive = _create_player(db, sport, real_team, name="Star Keeper", cost=50)

        # Give the team enough finalized points to cover the shortfall.
        db.add(TeamWeeklyScore(fantasy_team_id=team.id, transfer_window_id=past_window.id, points=100))
        db.flush()

        transfer = league_service.make_transfer(
            db, league.id, player_out.id, expensive.id, owner, pay_shortfall_with_points=True,
        )
        db.flush()

        db.refresh(team)
        assert team.current_budget == Decimal("0.00")
        assert transfer.points_charged is not None
        assert transfer.points_charged > 0

        penalties = db.query(PointsPenalty).filter(PointsPenalty.fantasy_team_id == team.id).all()
        assert len(penalties) == 1
        assert penalties[0].points_charged == transfer.points_charged
        assert penalties[0].reason == "budget_overage"

        # current_budget=2.00, refund on player_out(cost=1) is 1 - 0.10 penalty = 0.90,
        # incoming costs 50 -> budget_after = 2.00 + 0.90 - 50 = -47.10 -> shortfall 47.10,
        # points_cost = shortfall * BUDGET_OVERAGE_POINTS_RATE(1.0).
        expected_points_cost = (Decimal("47.10") * settings.BUDGET_OVERAGE_POINTS_RATE).quantize(Decimal("0.01"))
        assert penalties[0].points_charged == expected_points_cost


def test_make_transfer_insufficient_points_still_blocks() -> None:
    with session_scope() as db:
        sport, real_team, owner, league, team, player_out, past_window, future_window = _setup_league_with_team(db)
        expensive = _create_player(db, sport, real_team, name="Star Keeper", cost=50)

        # No TeamWeeklyScore rows -> 0 available points.
        with pytest.raises(HTTPException) as exc:
            league_service.make_transfer(
                db, league.id, player_out.id, expensive.id, owner, pay_shortfall_with_points=True,
            )

        assert exc.value.status_code == 409
        assert exc.value.detail["error"] == "insufficient_points"


def test_leaderboard_and_ranking_reflect_points_penalty() -> None:
    with session_scope() as db:
        sport, real_team, owner, league, team, player_out, past_window, future_window = _setup_league_with_team(db)
        rival = _create_user(db, "rival")
        league_service.join_league(db, league.invite_code, rival)
        rival_team = FantasyTeam(
            league_id=league.id, user_id=rival.id, name="Rival Team",
            current_budget=Decimal("0.00"), starting_budget=league.budget_per_team,
            starting_squad_size=1,
        )
        db.add(rival_team)
        db.flush()

        # Owner: 100 points, rival: 90 -> owner leads before penalty. Attached
        # to future_window: that's the editable window make_transfer() will
        # use below, and thus where the resulting PointsPenalty lands too —
        # so this same window also funds get_available_points_for_penalty()
        # (which sums across all windows regardless of which one).
        db.add(TeamWeeklyScore(fantasy_team_id=team.id, transfer_window_id=future_window.id, points=100))
        db.add(TeamWeeklyScore(fantasy_team_id=rival_team.id, transfer_window_id=future_window.id, points=90))
        db.flush()

        expensive = _create_player(db, sport, real_team, name="Star Keeper", cost=50)
        league_service.make_transfer(
            db, league.id, player_out.id, expensive.id, owner, pay_shortfall_with_points=True,
        )
        db.flush()

        penalty = db.query(PointsPenalty).filter(PointsPenalty.fantasy_team_id == team.id).first()
        assert penalty is not None
        assert penalty.transfer_window_id == future_window.id
        assert penalty.points_charged >= Decimal("11")  # shortfall was ~48 -> well over 10

        # Season-total leaderboard reflects the deduction.
        board = league_service.get_league_leaderboard(db, league.id, historical=True)
        by_team = {e["team_id"]: e["points"] for e in board["entries"]}
        assert by_team[team.id] == Decimal("100") - penalty.points_charged

        # Window-specific leaderboard also reflects it, scoped to the window
        # the transfer/penalty actually happened in.
        window_board = league_service.get_league_leaderboard(
            db, league.id, window_id=future_window.id, historical=True,
        )
        by_team_window = {e["team_id"]: e["points"] for e in window_board["entries"]}
        assert by_team_window[team.id] == Decimal("100") - penalty.points_charged

        # Ranking flips: rival (90, no penalty) now outranks owner (100 - big penalty).
        ranking.apply_rankings_for_league_window(
            db, league_id=league.id, transfer_window_id=future_window.id,
        )
        db.flush()
        owner_score = db.query(TeamWeeklyScore).filter(TeamWeeklyScore.fantasy_team_id == team.id).first()
        rival_score = db.query(TeamWeeklyScore).filter(TeamWeeklyScore.fantasy_team_id == rival_team.id).first()
        assert rival_score.rank_in_league == 1
        assert owner_score.rank_in_league == 2

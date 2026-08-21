"""The season leaderboard must list every ACTIVE member, scoring or not.

A 20-member league was returning 8 rows. Two independent gaps, both invisible
to the manager who fell into one:

  * A member stamped with `eligible_from_window_id` was hidden until that
    window's `start_at` passed — even though every *scoring* consumer compares
    window NUMBERS and was already counting them correctly. A league that
    auto-flips ACTIVE on its season start date, before window 1 opens, stamps
    everyone who joins that day, so they all vanished.
  * Both leaderboard branches drive from FantasyTeam, so a member who joined
    and never built a squad has no row to return at all.

The fix shows both at 0 with the reason attached. This test is the guard: it
would go red if either gap came back, and red again if the teamless append
started double-listing a member whose only team is archived.
"""

from __future__ import annotations

import os
import sys
import tempfile
import uuid
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_temp_dir = tempfile.mkdtemp(prefix="sporty-leaderboard-members-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'lb.db'}"
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
from app.league import read_cache, standings_service
from app.league import services as league_service
from app.league.models import (
    FantasyTeam,
    FantasyTeamStatus,
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


@pytest.fixture(autouse=True)
def _no_read_cache(monkeypatch):
    """Bypass the 30s Redis leaderboard cache.

    Without this the test either blocks on a 5s Redis connect timeout twice, or
    (on a dev box with Redis up) reads a payload another run left behind.
    """
    monkeypatch.setattr(read_cache, "get_cached", lambda key: None)
    monkeypatch.setattr(read_cache, "set_cached", lambda key, value, ttl: None)


@contextmanager
def session_scope():
    Base.metadata.drop_all(bind=ENGINE)
    Base.metadata.create_all(bind=ENGINE)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _user(db, name: str) -> User:
    user = User(
        username=name,
        email=f"{name}@example.com",
        auth_provider=AuthProvider.LOCAL,
        password_hash="hashed-password",
    )
    db.add(user)
    db.flush()
    return user


def _team(db, league, user, *, status=FantasyTeamStatus.ACTIVE) -> FantasyTeam:
    team = FantasyTeam(
        league_id=league.id,
        user_id=user.id,
        name=f"{user.username} FC",
        current_budget=Decimal("100"),
        starting_budget=Decimal("100"),
        starting_squad_size=league.squad_size,
        status=status,
    )
    db.add(team)
    db.flush()
    return team


def _member(db, league, user, *, eligible_from=None) -> LeagueMembership:
    membership = LeagueMembership(
        league_id=league.id,
        user_id=user.id,
        status=LeagueMembershipStatus.ACTIVE,
        eligible_from_window_id=eligible_from.id if eligible_from else None,
    )
    db.add(membership)
    db.flush()
    return membership


def _league_with_two_windows(db):
    """ACTIVE league whose window 1 has played and window 2 has not opened.

    `create_league` auto-enrols the owner, so the owner already has an ACTIVE
    membership with a NULL eligible_from_window_id — the "normal member" case.
    """
    owner = _user(db, "owner")
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
    league.status = LeagueStatus.ACTIVE
    db.flush()

    now = datetime.now(timezone.utc)
    windows = []
    for number, offset in ((1, timedelta(days=-10)), (2, timedelta(days=4))):
        window = TransferWindow(
            season_id=season.id,
            competition=None,
            number=number,
            start_at=now + offset,
            end_at=now + offset + timedelta(days=6),
            transfer_deadline_at=now + offset,
            lineup_deadline_at=now + offset + timedelta(hours=1),
        )
        db.add(window)
        windows.append(window)
    db.flush()
    return league, owner, windows


def _entries_by_owner(db, league, **kwargs):
    board = standings_service.get_league_leaderboard(db, league.id, **kwargs)
    return {entry["owner_name"]: entry for entry in board["entries"]}


def test_season_leaderboard_lists_scoring_pending_and_teamless_members() -> None:
    with session_scope() as db:
        league, owner, (gw1, gw2) = _league_with_two_windows(db)

        # (a) normal member: enrolled at creation, scored in window 1.
        owner_team = _team(db, league, owner)
        db.add(
            TeamWeeklyScore(
                fantasy_team_id=owner_team.id,
                transfer_window_id=gw1.id,
                points=Decimal("42"),
                rank_in_league=1,
            )
        )

        # (b) midseason joiner stamped with window 2, which has NOT started —
        # the case the old wall-clock filter dropped from the response.
        pending = _user(db, "pending")
        _member(db, league, pending, eligible_from=gw2)
        _team(db, league, pending)

        # (c) joined, never built a squad — no FantasyTeam row at all.
        teamless = _user(db, "teamless")
        _member(db, league, teamless)
        db.flush()

        entries = _entries_by_owner(db, league)

        assert set(entries) == {"owner", "pending", "teamless"}

        assert Decimal(str(entries["owner"]["points"])) == Decimal("42")
        assert entries["owner"]["eligible_from_gameweek"] is None
        assert entries["owner"]["team_id"] == owner_team.id

        # Visible, at zero, and carrying the gameweek that explains the zero.
        assert Decimal(str(entries["pending"]["points"])) == Decimal("0")
        assert entries["pending"]["eligible_from_gameweek"] == 2

        # Teamless rows are unranked and carry no team, so the client can say
        # "No squad yet" instead of rendering a phantom 0-point team.
        assert entries["teamless"]["team_id"] is None
        assert entries["teamless"]["team_name"] is None
        assert entries["teamless"]["rank"] is None
        assert Decimal(str(entries["teamless"]["points"])) == Decimal("0")


def test_a_member_whose_only_team_is_archived_is_listed_once() -> None:
    """The teamless append keys on ZERO FantasyTeam rows, not "no ACTIVE team".

    The main query has no status filter — archived teams stay visible so
    historical=True preserves departed managers — so matching on ACTIVE here
    would list this member twice.
    """
    with session_scope() as db:
        league, owner, (gw1, _gw2) = _league_with_two_windows(db)
        _team(db, league, owner)

        quitter = _user(db, "quitter")
        _member(db, league, quitter)
        _team(db, league, quitter, status=FantasyTeamStatus.ARCHIVED)
        db.flush()

        board = standings_service.get_league_leaderboard(db, league.id)
        owners = [entry["owner_name"] for entry in board["entries"]]

        assert owners.count("quitter") == 1


def test_per_window_leaderboard_also_lists_teamless_members() -> None:
    """Same guarantee on the per-gameweek board — rows == member count there too."""
    with session_scope() as db:
        league, owner, (gw1, _gw2) = _league_with_two_windows(db)
        owner_team = _team(db, league, owner)
        db.add(
            TeamWeeklyScore(
                fantasy_team_id=owner_team.id,
                transfer_window_id=gw1.id,
                points=Decimal("7"),
                rank_in_league=1,
            )
        )
        teamless = _user(db, "teamless")
        _member(db, league, teamless)
        db.flush()

        entries = _entries_by_owner(db, league, window_id=gw1.id)

        assert set(entries) == {"owner", "teamless"}
        assert entries["teamless"]["team_id"] is None


def test_nobody_is_ranked_until_somebody_has_scored() -> None:
    """An all-zero board has no ranks — and ties share one once it does.

    upsert_team_weekly_scores writes a 0-point row for every eligible team the
    moment a window opens, so "everyone on 0" is the normal pre-kickoff state.
    Numbering those rows 1..N invents a standings order (it used to come out in
    insertion order, so the first manager to join looked like the leader).
    """
    with session_scope() as db:
        league, owner, (gw1, _gw2) = _league_with_two_windows(db)
        teams = {"owner": _team(db, league, owner)}
        for name in ("blanked", "tied_a", "tied_b"):
            user = _user(db, name)
            _member(db, league, user)
            teams[name] = _team(db, league, user)

        # Placeholder rows exactly as the scoring engine writes them at window
        # open: a row per team, 0 points, rank_in_league NULL.
        for team in teams.values():
            db.add(
                TeamWeeklyScore(
                    fantasy_team_id=team.id,
                    transfer_window_id=gw1.id,
                    points=Decimal("0"),
                    rank_in_league=None,
                )
            )
        db.flush()

        for board in (
            _entries_by_owner(db, league),
            _entries_by_owner(db, league, window_id=gw1.id),
        ):
            assert len(board) == 4
            assert [entry["rank"] for entry in board.values()] == [None] * 4

        # One real score switches ranking back on for the whole board. The two
        # teams left on 0 tie, so they share a rank and the next rank skips —
        # the same semantics as the stored rank_in_league (ranking.py).
        db.query(TeamWeeklyScore).filter(
            TeamWeeklyScore.fantasy_team_id == teams["owner"].id
        ).update({"points": Decimal("30")})
        db.query(TeamWeeklyScore).filter(
            TeamWeeklyScore.fantasy_team_id == teams["blanked"].id
        ).update({"points": Decimal("-2")})
        db.flush()

        entries = _entries_by_owner(db, league, window_id=gw1.id)
        assert entries["owner"]["rank"] == 1
        assert entries["tied_a"]["rank"] == 2
        assert entries["tied_b"]["rank"] == 2
        # A negative total is scored, not unranked — it ranks below the zeros.
        assert entries["blanked"]["rank"] == 4

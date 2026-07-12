"""Beat the Optimizer — hindsight lineup score. SQLite throwaway DB, same
pattern as this session's other new test files."""
from __future__ import annotations

import os
import sys
import tempfile
import uuid
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_temp_dir = tempfile.mkdtemp(prefix="sporty-hindsight-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'hindsight.db'}"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["JWT_SECRET_KEY"] = "x" * 32
os.environ["GOOGLE_CLIENT_ID"] = "test-client"

_backend_root = Path(__file__).resolve().parents[1]
os.chdir(_temp_dir)
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from app.database import Base  # noqa: E402
from app.auth.models import AuthProvider, User  # noqa: E402
import app.match.models  # noqa: F401,E402
import app.player.models_nba  # noqa: F401,E402
from app.league import services as league_service  # noqa: E402
from app.league.models import (  # noqa: E402
    FantasyTeam,
    League,
    LineupSlot,
    Season,
    Sport,
    TeamGameweekLineup,
    TransferWindow,
)
from app.league.schemas import LeagueCreate  # noqa: E402
from app.player.models import Player, PlayerGameweekStat, RealTeam  # noqa: E402
from app.services.optimization.hindsight_service import compute_hindsight_lineup  # noqa: E402
from app.services.scoring.team_scoring import LineupRow  # noqa: E402

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


def _sport(db, name="football"):
    sport = Sport(name=name, display_name=name.title())
    db.add(sport)
    db.flush()
    return sport


def _player(db, sport, rt, name, position, cost, external_suffix=None):
    p = Player(
        sport_id=sport.id, external_api_id=f"p:{external_suffix or uuid.uuid4().hex[:10]}",
        name=name, position=position, real_team=rt.name, real_team_id=rt.id,
        cost=Decimal(str(cost)), is_available=True,
    )
    db.add(p)
    db.flush()
    return p


# ── compute_hindsight_lineup, direct unit tests ──────────────────────────────


def test_finds_a_better_bench_option_than_the_actual_starters():
    with session_scope() as db:
        sport = _sport(db)
        rt = RealTeam(sport_id=sport.id, name="Club A", external_api_id="rt:a")
        db.add(rt)
        db.flush()

        starter_a = _player(db, sport, rt, "Starter A", "MID", 5)
        starter_b = _player(db, sport, rt, "Starter B", "MID", 5)
        bench_c = _player(db, sport, rt, "Bench C", "MID", 5)
        db.commit()

        players_by_id = {p.id: p for p in (starter_a, starter_b, bench_c)}
        rows = [
            LineupRow(player_id=starter_a.id, sport_id=sport.id, position="MID",
                      is_starter=True, bench_order=None, is_captain=False,
                      is_vice_captain=False, minutes_played=90, points=Decimal("5")),
            LineupRow(player_id=starter_b.id, sport_id=sport.id, position="MID",
                      is_starter=True, bench_order=None, is_captain=False,
                      is_vice_captain=False, minutes_played=90, points=Decimal("3")),
            LineupRow(player_id=bench_c.id, sport_id=sport.id, position="MID",
                      is_starter=False, bench_order=1, is_captain=False,
                      is_vice_captain=False, minutes_played=90, points=Decimal("10")),
        ]
        slot_bounds = {(sport.id, "MID"): (2, 2)}

        result = compute_hindsight_lineup(
            rows=rows, players_by_id=players_by_id, slot_bounds=slot_bounds,
            actual_total_points=Decimal("13"),  # 5 + 3 + captain bonus(5) as actually set
        )

        assert result is not None
        # Best: starter_a(5) + bench_c(10), captain on bench_c(10) -> 5+10+10=25
        assert result.best_possible_points == Decimal("25")
        assert result.capture_rate < 100.0


def test_capture_rate_is_100_when_actual_lineup_was_already_optimal():
    with session_scope() as db:
        sport = _sport(db)
        rt = RealTeam(sport_id=sport.id, name="Club A", external_api_id="rt:a")
        db.add(rt)
        db.flush()

        # Exactly 2 candidates for 2 slots -> only one possible lineup, so
        # whatever the optimizer picks IS what "actually" happened.
        player_a = _player(db, sport, rt, "Player A", "MID", 5)
        player_b = _player(db, sport, rt, "Player B", "MID", 5)
        db.commit()

        players_by_id = {p.id: p for p in (player_a, player_b)}
        rows = [
            LineupRow(player_id=player_a.id, sport_id=sport.id, position="MID",
                      is_starter=True, bench_order=None, is_captain=True,
                      is_vice_captain=False, minutes_played=90, points=Decimal("5")),
            LineupRow(player_id=player_b.id, sport_id=sport.id, position="MID",
                      is_starter=True, bench_order=None, is_captain=False,
                      is_vice_captain=False, minutes_played=90, points=Decimal("3")),
        ]
        slot_bounds = {(sport.id, "MID"): (2, 2)}

        # Real captain (A, higher scorer) doubled: 5 + 3 + 5 = 13, same as
        # what the optimizer is forced to produce with no alternative.
        result = compute_hindsight_lineup(
            rows=rows, players_by_id=players_by_id, slot_bounds=slot_bounds,
            actual_total_points=Decimal("13"),
        )

        assert result is not None
        assert result.best_possible_points == Decimal("13")
        assert result.capture_rate == 100.0


def test_returns_none_for_empty_rows():
    result = compute_hindsight_lineup(
        rows=[], players_by_id={}, slot_bounds={}, actual_total_points=Decimal("0"),
    )
    assert result is None


def test_sanity_guard_returns_none_if_best_possible_would_be_below_actual():
    with session_scope() as db:
        sport = _sport(db)
        rt = RealTeam(sport_id=sport.id, name="Club A", external_api_id="rt:a")
        db.add(rt)
        db.flush()
        player_a = _player(db, sport, rt, "Player A", "MID", 5)
        player_b = _player(db, sport, rt, "Player B", "MID", 5)
        db.commit()

        players_by_id = {player_a.id: player_a, player_b.id: player_b}
        rows = [
            LineupRow(player_id=player_a.id, sport_id=sport.id, position="MID",
                      is_starter=True, bench_order=None, is_captain=True,
                      is_vice_captain=False, minutes_played=90, points=Decimal("5")),
            LineupRow(player_id=player_b.id, sport_id=sport.id, position="MID",
                      is_starter=True, bench_order=None, is_captain=False,
                      is_vice_captain=False, minutes_played=90, points=Decimal("3")),
        ]
        slot_bounds = {(sport.id, "MID"): (2, 2)}

        # Impossibly high "actual" (best possible here is 5+3+5=13 with
        # captain bonus) — guard must trip rather than report a >100%
        # capture rate.
        result = compute_hindsight_lineup(
            rows=rows, players_by_id=players_by_id, slot_bounds=slot_bounds,
            actual_total_points=Decimal("999"),
        )
        assert result is None


# ── get_gameweek_recap integration ───────────────────────────────────────────


def _now_minus(days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)


def _now_plus(days: int) -> datetime:
    return datetime.now(timezone.utc) + timedelta(days=days)


def test_gameweek_recap_includes_hindsight_fields_for_a_played_window():
    with session_scope() as db:
        owner = User(username="owner", email="owner@e.com",
                     auth_provider=AuthProvider.LOCAL, password_hash="h")
        db.add(owner)
        sport = _sport(db)
        rt = RealTeam(sport_id=sport.id, name="Club A", external_api_id="rt:a")
        db.add(rt)
        db.flush()

        season = Season(sport_id=sport.id, name=f"S-{uuid.uuid4().hex[:6]}",
                        start_date=date(2020, 1, 1), end_date=date(2030, 12, 31))
        db.add(season)
        db.flush()

        played_window = TransferWindow(
            season_id=season.id, number=1,
            start_at=_now_minus(7), end_at=_now_minus(1),
            transfer_deadline_at=_now_minus(8), lineup_deadline_at=_now_minus(7),
        )
        future_window = TransferWindow(
            season_id=season.id, number=2,
            start_at=_now_plus(7), end_at=_now_plus(14),
            transfer_deadline_at=_now_plus(6), lineup_deadline_at=_now_plus(6),
        )
        db.add_all([played_window, future_window])
        db.flush()

        league = league_service.create_league(
            db, LeagueCreate(name="Hindsight League", season_id=season.id,
                             draft_mode=False, sports=["football"]), owner)
        db.flush()

        team = FantasyTeam(league_id=league.id, user_id=owner.id, name="Owner FC",
                           current_budget=league.budget_per_team,
                           starting_budget=league.budget_per_team,
                           starting_squad_size=league.squad_size)
        db.add(team)

        db.add(LineupSlot(league_id=league.id, sport_id=sport.id, position="MID",
                          min_count=2, max_count=2))

        # Two starters, no bench — the "swap" here is captaincy, not
        # selection: A(4, captained) + B(9, not captained) actually played,
        # but the optimizer would've captained B instead.
        player_a = _player(db, sport, rt, "Player A", "MID", 5)
        player_b = _player(db, sport, rt, "Player B", "MID", 5)
        db.flush()

        for window in (played_window, future_window):
            db.add(TeamGameweekLineup(fantasy_team_id=team.id, transfer_window_id=window.id,
                                      player_id=player_a.id, is_starter=True, is_captain=True))
            db.add(TeamGameweekLineup(fantasy_team_id=team.id, transfer_window_id=window.id,
                                      player_id=player_b.id, is_starter=True))

        db.add(PlayerGameweekStat(player_id=player_a.id, transfer_window_id=played_window.id,
                                  minutes_played=90, fantasy_points=Decimal("4")))
        db.add(PlayerGameweekStat(player_id=player_b.id, transfer_window_id=played_window.id,
                                  minutes_played=90, fantasy_points=Decimal("9")))
        # flush (not commit) — a commit triggers expire_on_commit, forcing a
        # real SQLite re-SELECT that drops tzinfo on window.start_at and
        # breaks the naive/aware comparison in get_gameweek_recap. Without a
        # commit the session's identity map keeps serving the tz-aware
        # objects as constructed. See sqlite-test-tzinfo gotcha (memory).
        db.flush()

        played_recap = league_service.get_gameweek_recap(
            db, league.id, owner.id, window_id=played_window.id,
        )
        assert played_recap["best_possible_points"] is not None
        assert played_recap["capture_rate"] is not None
        # Both forced-selected (2 candidates, 2 slots); optimizer captains
        # the higher scorer -> 4 + 9 + 9 (captain bonus on B) = 22. Actual
        # captained A instead -> 4 + 9 + 4 = 17 (asserted implicitly via
        # capture_rate < 100).
        assert played_recap["best_possible_points"] == Decimal("22")
        assert played_recap["capture_rate"] < 100.0

        future_recap = league_service.get_gameweek_recap(
            db, league.id, owner.id, window_id=future_window.id,
        )
        assert future_recap["best_possible_points"] is None
        assert future_recap["capture_rate"] is None

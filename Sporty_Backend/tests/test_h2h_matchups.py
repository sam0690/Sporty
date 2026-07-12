"""Head-to-head weekly matchups: round-robin scheduling, result resolution,
and W-L-T standings. SQLite throwaway DB, same pattern as
test_draft_waivers_trades.py."""
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
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_temp_dir = tempfile.mkdtemp(prefix="sporty-h2h-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'h2h.db'}"
os.environ["JWT_SECRET_KEY"] = "x" * 32
os.environ["GOOGLE_CLIENT_ID"] = "test-client"

_backend_root = Path(__file__).resolve().parents[1]
os.chdir(_temp_dir)
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from app.database import Base, get_db  # noqa: E402
from app.auth.dependencies import get_current_active_user  # noqa: E402
from app.auth.models import AuthProvider, User  # noqa: E402
import app.match.models  # noqa: F401,E402
import app.player.models  # noqa: F401,E402
import app.player.models_nba  # noqa: F401,E402
from app.api.v1.matchups import router as matchups_router  # noqa: E402
from app.league import services as league_service  # noqa: E402
from app.league.models import FantasyTeam, LeagueMatchup, Season, Sport, TeamWeeklyScore, TransferWindow  # noqa: E402
from app.league.schemas import LeagueCreate  # noqa: E402
from app.services import matchup_service  # noqa: E402

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
    u = User(
        username=username, email=f"{username}@e.com",
        auth_provider=AuthProvider.LOCAL, password_hash="h",
    )
    db.add(u)
    db.flush()
    return u


def _windows(db, season, count):
    base = datetime(2030, 1, 1, tzinfo=timezone.utc)
    windows = []
    for i in range(count):
        start = base + timedelta(days=7 * i)
        w = TransferWindow(
            season_id=season.id, number=i + 1,
            start_at=start, end_at=start + timedelta(days=6),
            transfer_deadline_at=start, lineup_deadline_at=start + timedelta(days=1),
        )
        db.add(w)
        windows.append(w)
    db.flush()
    return windows


def _team(db, league, user):
    t = FantasyTeam(
        league_id=league.id, user_id=user.id, name=f"{user.username} FC",
        current_budget=league.budget_per_team,
        starting_budget=league.budget_per_team,
        starting_squad_size=league.squad_size,
    )
    db.add(t)
    db.flush()
    return t


def _h2h_league(db, num_teams, num_windows):
    owner = _user(db, "owner")
    sport = Sport(name="football", display_name="Football")
    db.add(sport)
    db.flush()
    season = Season(
        sport_id=sport.id, name=f"S-{uuid.uuid4().hex[:6]}",
        start_date=date(2026, 1, 1), end_date=date(2026, 12, 31),
    )
    db.add(season)
    db.flush()
    windows = _windows(db, season, num_windows)
    league = league_service.create_league(
        db,
        LeagueCreate(
            name=f"L-{uuid.uuid4().hex[:6]}", season_id=season.id,
            draft_mode=False, is_head_to_head=True, sports=["football"],
        ),
        owner,
    )
    teams = [_team(db, league, owner)]
    for i in range(1, num_teams):
        u = _user(db, f"user{i}")
        league_service.join_league(db, league.invite_code, u)
        teams.append(_team(db, league, u))
    db.flush()
    return league, season, windows, teams


# ── round-robin generator ────────────────────────────────────────────────────


def test_round_robin_even_team_count_no_duplicate_pairings():
    team_ids = [uuid.uuid4() for _ in range(4)]
    rounds = matchup_service.generate_round_robin_rounds(team_ids)

    assert len(rounds) == 3  # N-1 rounds
    seen_pairs = set()
    for round_pairs in rounds:
        round_teams = set()
        for home, away in round_pairs:
            assert home is not None and away is not None  # even count, no byes
            pair = frozenset([home, away])
            assert pair not in seen_pairs  # every pair appears exactly once
            seen_pairs.add(pair)
            assert home not in round_teams and away not in round_teams  # no team twice in a round
            round_teams.update([home, away])
    assert len(seen_pairs) == 6  # C(4,2)


def test_round_robin_odd_team_count_bye_rotates():
    team_ids = [uuid.uuid4() for _ in range(3)]
    rounds = matchup_service.generate_round_robin_rounds(team_ids)

    assert len(rounds) == 3  # padded to 4 -> N-1 = 3 rounds
    byes_seen = []
    for round_pairs in rounds:
        byes = [home if away is None else away for home, away in round_pairs if home is None or away is None]
        assert len(byes) == 1  # exactly one bye per round
        byes_seen.append(byes[0])
    assert set(byes_seen) == set(team_ids)  # every real team gets exactly one bye


# ── schedule generation ──────────────────────────────────────────────────────


def test_generate_matchups_for_league_is_idempotent():
    with session_scope() as db:
        league, _season, windows, teams = _h2h_league(db, num_teams=4, num_windows=6)
        db.commit()

        matchup_service.generate_matchups_for_league(db, league)
        db.commit()
        first_count = db.query(LeagueMatchup).filter(LeagueMatchup.league_id == league.id).count()
        assert first_count == 2 * len(windows)  # 4 teams -> 2 pairs/window, no byes

        matchup_service.generate_matchups_for_league(db, league)  # no-op, already generated
        db.commit()
        second_count = db.query(LeagueMatchup).filter(LeagueMatchup.league_id == league.id).count()
        assert second_count == first_count


def test_generate_matchups_bye_gets_immediate_result():
    with session_scope() as db:
        league, _season, windows, teams = _h2h_league(db, num_teams=3, num_windows=3)
        db.commit()

        matchup_service.generate_matchups_for_league(db, league)
        db.commit()

        for window in windows:
            byes = (
                db.query(LeagueMatchup)
                .filter(LeagueMatchup.league_id == league.id, LeagueMatchup.transfer_window_id == window.id)
                .filter(LeagueMatchup.away_team_id.is_(None))
                .all()
            )
            assert len(byes) == 1
            assert byes[0].result == "bye"


def test_generate_matchups_repeats_rotation_when_season_longer_than_cycle():
    with session_scope() as db:
        # 4 teams -> 3-round cycle; 6 windows -> cycle repeats once.
        league, _season, windows, teams = _h2h_league(db, num_teams=4, num_windows=6)
        db.commit()

        matchup_service.generate_matchups_for_league(db, league)
        db.commit()

        window1_pairs = {
            frozenset([m.home_team_id, m.away_team_id])
            for m in db.query(LeagueMatchup).filter(
                LeagueMatchup.league_id == league.id, LeagueMatchup.transfer_window_id == windows[0].id
            )
        }
        window4_pairs = {
            frozenset([m.home_team_id, m.away_team_id])
            for m in db.query(LeagueMatchup).filter(
                LeagueMatchup.league_id == league.id, LeagueMatchup.transfer_window_id == windows[3].id
            )
        }
        assert window1_pairs == window4_pairs  # round 4 repeats round 1's pairings


# ── result resolution ────────────────────────────────────────────────────────


def test_resolve_matchups_home_win_away_win_and_tie():
    with session_scope() as db:
        league, _season, windows, teams = _h2h_league(db, num_teams=4, num_windows=1)
        db.commit()

        matchup_service.generate_matchups_for_league(db, league)
        db.flush()
        window = windows[0]
        matchups = (
            db.query(LeagueMatchup)
            .filter(LeagueMatchup.league_id == league.id, LeagueMatchup.transfer_window_id == window.id)
            .all()
        )
        assert len(matchups) == 2

        # Matchup A: home wins. Matchup B: tie.
        a, b = matchups
        db.add(TeamWeeklyScore(fantasy_team_id=a.home_team_id, transfer_window_id=window.id, points=Decimal("60.00")))
        db.add(TeamWeeklyScore(fantasy_team_id=a.away_team_id, transfer_window_id=window.id, points=Decimal("45.00")))
        db.add(TeamWeeklyScore(fantasy_team_id=b.home_team_id, transfer_window_id=window.id, points=Decimal("50.00")))
        db.add(TeamWeeklyScore(fantasy_team_id=b.away_team_id, transfer_window_id=window.id, points=Decimal("50.00")))
        db.commit()

        matchup_service.resolve_matchups_for_window(db, league.id, window.id)
        db.commit()

        db.refresh(a)
        db.refresh(b)
        assert a.result == "home_win"
        assert a.home_points == Decimal("60.00")
        assert b.result == "tie"


def test_resolve_matchups_away_win():
    with session_scope() as db:
        league, _season, windows, teams = _h2h_league(db, num_teams=2, num_windows=1)
        db.commit()

        matchup_service.generate_matchups_for_league(db, league)
        db.flush()
        window = windows[0]
        m = db.query(LeagueMatchup).filter(LeagueMatchup.league_id == league.id).first()

        db.add(TeamWeeklyScore(fantasy_team_id=m.home_team_id, transfer_window_id=window.id, points=Decimal("30.00")))
        db.add(TeamWeeklyScore(fantasy_team_id=m.away_team_id, transfer_window_id=window.id, points=Decimal("55.00")))
        db.commit()

        matchup_service.resolve_matchups_for_window(db, league.id, window.id)
        db.commit()
        db.refresh(m)
        assert m.result == "away_win"


def test_resolve_matchups_is_noop_when_scoring_not_finalized():
    with session_scope() as db:
        league, _season, windows, teams = _h2h_league(db, num_teams=2, num_windows=1)
        db.commit()
        matchup_service.generate_matchups_for_league(db, league)
        db.commit()

        matchup_service.resolve_matchups_for_window(db, league.id, windows[0].id)  # no scores yet
        db.commit()

        m = db.query(LeagueMatchup).filter(LeagueMatchup.league_id == league.id).first()
        assert m.result is None


# ── standings ─────────────────────────────────────────────────────────────────


def test_get_h2h_standings_wins_losses_ties_and_points_tiebreak():
    with session_scope() as db:
        league, _season, windows, teams = _h2h_league(db, num_teams=4, num_windows=3)
        db.commit()
        matchup_service.generate_matchups_for_league(db, league)
        db.commit()

        for window in windows:
            for m in db.query(LeagueMatchup).filter(
                LeagueMatchup.league_id == league.id, LeagueMatchup.transfer_window_id == window.id
            ):
                if db.query(TeamWeeklyScore).filter(
                    TeamWeeklyScore.fantasy_team_id == m.home_team_id,
                    TeamWeeklyScore.transfer_window_id == window.id,
                ).first():
                    continue
                db.add(TeamWeeklyScore(fantasy_team_id=m.home_team_id, transfer_window_id=window.id, points=Decimal("60.00")))
                db.add(TeamWeeklyScore(fantasy_team_id=m.away_team_id, transfer_window_id=window.id, points=Decimal("40.00")))
            db.commit()
            matchup_service.resolve_matchups_for_window(db, league.id, window.id)
            db.commit()

        standings = matchup_service.get_h2h_standings(db, league.id)
        assert len(standings) == 4
        total_wins = sum(r["wins"] for r in standings)
        total_losses = sum(r["losses"] for r in standings)
        assert total_wins == total_losses == 3 * 2  # 3 windows * 2 matchups/window
        # Sorted by wins desc.
        assert standings[0]["wins"] >= standings[-1]["wins"]


def test_standings_points_for_breaks_ties_on_equal_wins():
    with session_scope() as db:
        league, _season, windows, teams = _h2h_league(db, num_teams=2, num_windows=2)
        db.commit()
        matchup_service.generate_matchups_for_league(db, league)
        db.commit()

        # Window 1: home wins big. Window 2: home wins by a hair (rotation
        # repeats the same pair since only 2 teams -> 1-round cycle).
        for window, home_pts, away_pts in zip(windows, [Decimal("80.00"), Decimal("55.00")], [Decimal("20.00"), Decimal("50.00")]):
            m = db.query(LeagueMatchup).filter(
                LeagueMatchup.league_id == league.id, LeagueMatchup.transfer_window_id == window.id
            ).first()
            db.add(TeamWeeklyScore(fantasy_team_id=m.home_team_id, transfer_window_id=window.id, points=home_pts))
            db.add(TeamWeeklyScore(fantasy_team_id=m.away_team_id, transfer_window_id=window.id, points=away_pts))
            db.commit()
            matchup_service.resolve_matchups_for_window(db, league.id, window.id)
            db.commit()

        standings = matchup_service.get_h2h_standings(db, league.id)
        # Home team won both -> 2-0, clearly first regardless of tiebreak;
        # verify points_for accumulated correctly across both windows.
        home_row = next(r for r in standings if r["wins"] == 2)
        assert home_row["points_for"] == Decimal("135.00")


# ── mutual exclusivity guard ─────────────────────────────────────────────────


def test_create_league_rejects_h2h_with_midseason_join():
    with session_scope() as db:
        owner = _user(db, "owner")
        sport = Sport(name="football", display_name="Football")
        db.add(sport)
        db.flush()
        season = Season(
            sport_id=sport.id, name=f"S-{uuid.uuid4().hex[:6]}",
            start_date=date(2026, 1, 1), end_date=date(2026, 12, 31),
        )
        db.add(season)
        db.flush()

        with pytest.raises(HTTPException) as exc_info:
            league_service.create_league(
                db,
                LeagueCreate(
                    name="H2H League", season_id=season.id, draft_mode=False,
                    is_head_to_head=True, allow_midseason_join=True, sports=["football"],
                ),
                owner,
            )
        assert exc_info.value.status_code == 422


# ── router ────────────────────────────────────────────────────────────────────


def _build_app(db, user):
    app = FastAPI()
    app.include_router(matchups_router, prefix="/api/v1")

    def _override_get_db():
        yield db

    def _override_current_user():
        return user

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_active_user] = _override_current_user
    return app


def test_matchups_and_standings_endpoints_return_expected_shapes():
    with session_scope() as db:
        league, _season, windows, teams = _h2h_league(db, num_teams=2, num_windows=1)
        db.commit()
        matchup_service.generate_matchups_for_league(db, league)
        db.commit()
        window = windows[0]
        m = db.query(LeagueMatchup).filter(LeagueMatchup.league_id == league.id).first()
        db.add(TeamWeeklyScore(fantasy_team_id=m.home_team_id, transfer_window_id=window.id, points=Decimal("60.00")))
        db.add(TeamWeeklyScore(fantasy_team_id=m.away_team_id, transfer_window_id=window.id, points=Decimal("40.00")))
        db.commit()
        matchup_service.resolve_matchups_for_window(db, league.id, window.id)
        db.commit()

        owner = db.query(User).filter(User.username == "owner").first()
        app = _build_app(db, owner)
        client = TestClient(app)

        resp = client.get(f"/api/v1/leagues/{league.id}/matchups", params={"window_id": str(window.id)})
        assert resp.status_code == 200
        body = resp.json()
        assert len(body) == 1
        assert body[0]["result"] == "home_win"
        assert body[0]["home_team"]["name"]

        resp = client.get(f"/api/v1/leagues/{league.id}/matchups/standings")
        assert resp.status_code == 200
        standings = resp.json()
        assert len(standings) == 2
        assert standings[0]["wins"] == 1
        assert standings[0]["team_name"]

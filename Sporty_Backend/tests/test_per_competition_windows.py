"""Per-competition transfer windows.

Two halves of one rule. Write side: a match's stats are a fact stored ONCE per
(player, match) — never once per covering window. Read side: each schedule's
gameweek total is a rollup over the matches inside its own date range and
competition scope, so the EPL and combined windows both show the match's points
and a sibling competition's window shows nothing.

SQLite throwaway DB, same bootstrap pattern as test_transfer_window_generation.py.
"""
from __future__ import annotations

import os
import sys
import tempfile
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

_temp_dir = tempfile.mkdtemp(prefix="sporty-percomp-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'percomp.db'}"
os.environ["JWT_SECRET_KEY"] = "x" * 32
os.environ["GOOGLE_CLIENT_ID"] = "test-client"

_backend_root = Path(__file__).resolve().parents[1]
os.chdir(_temp_dir)
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from app.database import Base  # noqa: E402
from app.auth.models import AuthProvider, User  # noqa: F401,E402
import app.match.models  # noqa: F401,E402
import app.player.models  # noqa: F401,E402
import app.player.models_nba  # noqa: F401,E402
import app.notification.models  # noqa: F401,E402
from app.league.models import Season, Sport, TransferWindow  # noqa: E402
from app.match.models import Match  # noqa: E402
from app.player.models import Player, PlayerGameweekStat, RealTeam  # noqa: E402
from app.player.services import get_player_recent_stats  # noqa: E402
from app.scoring.models import DefaultScoringRule, PlayerMatchScore  # noqa: E402
import app.services.scoring.player_scoring as player_scoring  # noqa: E402
from app.services.scoring.match_scoring import upsert_player_match_score  # noqa: E402
from app.services.scoring.player_scoring import (  # noqa: E402
    load_football_rules,
    score_football_players_for_window,
)
from app.services.scoring.window_locator import find_transfer_window_ids_for_datetime  # noqa: E402

ENGINE = create_engine(os.environ["DATABASE_URL"])
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=ENGINE)

T0 = datetime(2026, 8, 22, 14, 0, tzinfo=timezone.utc)


def _win(season_id, comp, number):
    return TransferWindow(
        season_id=season_id, competition=comp, number=number,
        start_at=T0 - timedelta(hours=1), end_at=T0 + timedelta(hours=1),
        transfer_deadline_at=T0 - timedelta(hours=1),
        lineup_deadline_at=T0 - timedelta(hours=1) + timedelta(minutes=1),
    )


def _fresh_db():
    Base.metadata.drop_all(bind=ENGINE)
    Base.metadata.create_all(bind=ENGINE)
    db = SessionLocal()
    football = Sport(id=uuid.uuid4(), name="football", display_name="Football")
    season = Season(
        id=uuid.uuid4(), sport_id=football.id, name="S", start_date=T0.date(),
        end_date=(T0 + timedelta(days=280)).date(),
    )
    db.add_all([football, season])
    # Three schedules overlapping the same instant: EPL, LALIGA, and combined.
    epl = _win(season.id, "EPL", 1)
    laliga = _win(season.id, "LALIGA", 1)
    combined = _win(season.id, None, 1)
    db.add_all([epl, laliga, combined])
    db.flush()
    return db, football.id, {"EPL": epl.id, "LALIGA": laliga.id, "COMBINED": combined.id}


def test_match_books_own_competition_plus_combined_only():
    db, sport_id, ids = _fresh_db()
    got = set(find_transfer_window_ids_for_datetime(
        db, match_date=T0, sport_id=sport_id, competition_tag="EPL",
    ))
    assert got == {ids["EPL"], ids["COMBINED"]}, "EPL match must book EPL + combined, not LALIGA"
    assert ids["LALIGA"] not in got
    db.close()


def test_no_tag_matches_every_covering_window():
    # Non-football sports pass competition_tag=None → no competition filter.
    db, sport_id, ids = _fresh_db()
    got = set(find_transfer_window_ids_for_datetime(
        db, match_date=T0, sport_id=sport_id, competition_tag=None,
    ))
    assert got == set(ids.values())
    db.close()


@contextmanager
def _no_redis_lock(*args, **kwargs):
    yield True


def _football_squad(db, sport_id):
    """A scoring rule set + one MID player, enough to score a match."""
    for action, position, mode, param, points in [
        ("appearance", None, "threshold", 1, 1),
        ("goal", "MID", "per_unit", None, 5),
    ]:
        db.add(DefaultScoringRule(
            sport_id=sport_id, action=action, position=position, mode=mode,
            param=(Decimal(param) if param is not None else None),
            points=Decimal(points), description="x",
        ))
    team = RealTeam(id=uuid.uuid4(), sport_id=sport_id, name="Club", external_api_id="rt")
    player = Player(
        id=uuid.uuid4(), sport_id=sport_id, external_api_id="p1", name="P", position="MID",
        real_team="Club", real_team_id=team.id, cost=Decimal("5"),
    )
    db.add_all([team, player])
    db.flush()
    return player


def _finished_match(db, sport_id, competition):
    match = Match(
        id=uuid.uuid4(), sport_id=sport_id, external_api_id=f"m:{uuid.uuid4().hex[:8]}",
        home_team="A", away_team="B", match_date=T0, status="finished",
        competition=competition, season="2026",
    )
    db.add(match)
    db.flush()
    return match


def _points(db, player_id, window_id):
    row = (
        db.query(PlayerGameweekStat)
        .filter(
            PlayerGameweekStat.player_id == player_id,
            PlayerGameweekStat.transfer_window_id == window_id,
        )
        .first()
    )
    return row.fantasy_points if row else None


def test_match_is_booked_once_and_rolls_up_per_schedule(monkeypatch):
    monkeypatch.setattr(player_scoring, "redis_lock", _no_redis_lock)
    db, sport_id, ids = _fresh_db()
    player = _football_squad(db, sport_id)
    match = _finished_match(db, sport_id, "Premier League")
    upsert_player_match_score(
        db, player_id=player.id, match_id=match.id, position="MID", minutes=90,
        stats={"minutes": 90, "goals": 1}, rules=load_football_rules(db, sport_id),
    )
    db.flush()

    # The fact is stored once, however many schedules cover the date.
    assert db.query(PlayerMatchScore).count() == 1

    for window_id in ids.values():
        score_football_players_for_window(
            db, sport_id=sport_id, transfer_window_id=window_id
        )
    db.flush()

    # appearance 1 + goal 5, in the EPL schedule AND the combined one — each a
    # sum over its own range, neither doubled.
    assert _points(db, player.id, ids["EPL"]) == Decimal(6)
    assert _points(db, player.id, ids["COMBINED"]) == Decimal(6)
    # ...and nothing at all in a sibling competition's overlapping window.
    assert _points(db, player.id, ids["LALIGA"]) is None
    db.close()


def test_recent_stats_shows_each_gameweek_once():
    # Read side of the same rule: dual-booked stats must not surface as two
    # "GW 1" rows on the league-agnostic player profile.
    db, sport_id, ids = _fresh_db()
    team = RealTeam(id=uuid.uuid4(), sport_id=sport_id, name="Alaves")
    player = Player(
        id=uuid.uuid4(), sport_id=sport_id, name="A. Manas", position="FWD",
        real_team="Alaves", real_team_id=team.id, cost=5.5,
    )
    db.add_all([team, player])
    for window_id in (ids["LALIGA"], ids["COMBINED"]):
        db.add(PlayerGameweekStat(
            id=uuid.uuid4(), player_id=player.id, transfer_window_id=window_id,
            minutes_played=57, fantasy_points=1,
        ))
    db.flush()

    rows = get_player_recent_stats(db, player.id, limit=10)
    assert [r.transfer_window.number for r in rows] == [1]
    assert rows[0].transfer_window.competition is None
    db.close()


if __name__ == "__main__":
    test_match_books_own_competition_plus_combined_only()
    test_no_tag_matches_every_covering_window()
    test_recent_stats_shows_each_gameweek_once()
    print("(the rollup test needs pytest's monkeypatch — run via pytest)")
    print("per-competition window booking: OK")

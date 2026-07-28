"""Batch/gameweek scoring (app/services/scoring/player_scoring.py) — the bulk
UPDATE that computes fantasy_points for every player from raw match stats.
This is the actual money/points-correctness path (Celery's
score.active_transfer_windows sweep + the match-finish trigger both funnel
through it) and previously had zero direct tests. SQLite throwaway DB, same
pattern as test_hindsight_lineup.py."""
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

_temp_dir = tempfile.mkdtemp(prefix="sporty-batch-scoring-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'batch_scoring.db'}"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["JWT_SECRET_KEY"] = "x" * 32
os.environ["GOOGLE_CLIENT_ID"] = "test-client"

_backend_root = Path(__file__).resolve().parents[1]
os.chdir(_temp_dir)
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from app.database import Base  # noqa: E402
import app.auth.models  # noqa: F401,E402
import app.match.models  # noqa: F401,E402
from app.league.models import Season, Sport, TransferWindow  # noqa: E402
from app.player.models import (  # noqa: E402
    CricketStat,
    FootballStat,
    Player,
    PlayerGameweekStat,
    RealTeam,
)
import app.player.models_nba  # noqa: F401,E402
from app.player.models_nba import NBAStat  # noqa: E402
from app.scoring.models import DefaultScoringRule  # noqa: E402
import app.services.scoring.player_scoring as player_scoring  # noqa: E402
from app.services.scoring.player_scoring import (  # noqa: E402
    score_cricket_players_for_window,
    score_football_players_for_window,
    score_nba_players_for_window,
)

ENGINE = create_engine(os.environ["DATABASE_URL"])
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=ENGINE)


@contextmanager
def _no_redis_lock(*args, **kwargs):
    # These tests exercise the SQL scoring computation, not the distributed
    # lock (which needs a live Redis this test environment doesn't have).
    yield True


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


def _window(db, sport):
    # Unique start_date per call — Season has a (sport_id, start_date)
    # uniqueness constraint, and some tests create two windows for one sport.
    offset = uuid.uuid4().int % 1000
    season = Season(sport_id=sport.id, name=f"S-{uuid.uuid4().hex[:6]}",
                     start_date=date(2020, 1, 1) + timedelta(days=offset),
                     end_date=date(2030, 12, 31))
    db.add(season)
    db.flush()
    now = datetime.now(timezone.utc)
    window = TransferWindow(
        season_id=season.id, number=1,
        start_at=now - timedelta(days=7), end_at=now - timedelta(days=1),
        transfer_deadline_at=now - timedelta(days=8), lineup_deadline_at=now - timedelta(days=7),
    )
    db.add(window)
    db.flush()
    return window


def _player(db, sport, rt, name="P"):
    p = Player(
        sport_id=sport.id, external_api_id=f"p:{uuid.uuid4().hex[:10]}",
        name=name, position="MID", real_team=rt.name, real_team_id=rt.id,
        cost=Decimal("5.0"), is_available=True,
    )
    db.add(p)
    db.flush()
    return p


def _base_stat(db, player, window, minutes=90):
    stat = PlayerGameweekStat(player_id=player.id, transfer_window_id=window.id, minutes_played=minutes)
    db.add(stat)
    db.flush()
    return stat


def _seed_football_rules(db, sport):
    """Minimal position-aware rule set for the new engine (subset of
    scripts/seed_football_scoring_rules.py)."""
    rules = [
        ("appearance", None, "threshold", 1, 1),
        ("appearance_full", None, "threshold", 60, 1),
        ("goal", "GKP", "per_unit", None, 6),
        ("goal", "DEF", "per_unit", None, 6),
        ("goal", "MID", "per_unit", None, 5),
        ("goal", "FWD", "per_unit", None, 4),
        ("assist", None, "per_unit", None, 3),
        ("clean_sheet", "GKP", "per_unit", None, 4),
        ("clean_sheet", "DEF", "per_unit", None, 4),
        ("save", "GKP", "per_n", 3, 1),
        ("yellow_card", None, "per_unit", None, -1),
    ]
    for action, position, mode, param, pts in rules:
        db.add(DefaultScoringRule(
            sport_id=sport.id, action=action, position=position, mode=mode,
            param=(Decimal(param) if param is not None else None),
            points=Decimal(pts), description=f"{action}/{position or 'ALL'}",
        ))
    db.flush()


def test_football_scoring_is_noop_without_rules(monkeypatch):
    # New engine has no code-side fallback: with nothing seeded it is a no-op
    # and must NOT clobber existing scores (vs the old fallback formula).
    monkeypatch.setattr(player_scoring, "redis_lock", _no_redis_lock)
    with session_scope() as db:
        sport = _sport(db, "football")
        rt = RealTeam(sport_id=sport.id, name="Club A", external_api_id="rt:a")
        db.add(rt)
        db.flush()
        window = _window(db, sport)
        player = _player(db, sport, rt)
        base = _base_stat(db, player, window)
        base.fantasy_points = Decimal("99.00")  # sentinel — must be preserved
        db.add(FootballStat(base_stat_id=base.id, goals=2, assists=1, yellow_cards=1, red_cards=0))
        db.commit()

        updated = score_football_players_for_window(db, sport_id=sport.id, transfer_window_id=window.id)
        db.commit()

        assert updated == 0
        db.refresh(base)
        assert base.fantasy_points == Decimal("99.00")


def test_football_scoring_is_position_aware_with_appearance(monkeypatch):
    # A midfielder: appearance(90') 2 + goal 2*5 + assist 3 + yellow -1 = 14,
    # and the explainable breakdown is written alongside.
    monkeypatch.setattr(player_scoring, "redis_lock", _no_redis_lock)
    with session_scope() as db:
        sport = _sport(db, "football")
        _seed_football_rules(db, sport)
        rt = RealTeam(sport_id=sport.id, name="Club A", external_api_id="rt:a")
        db.add(rt)
        db.flush()
        window = _window(db, sport)
        player = _player(db, sport, rt)  # position MID
        base = _base_stat(db, player, window)
        db.add(FootballStat(base_stat_id=base.id, goals=2, assists=1, yellow_cards=1, red_cards=0))
        db.commit()

        score_football_players_for_window(db, sport_id=sport.id, transfer_window_id=window.id)
        db.commit()

        db.refresh(base)
        assert base.fantasy_points == Decimal("14.00")
        actions = {b["action"] for b in (base.breakdown or [])}
        assert {"appearance", "goal", "assist", "yellow_card"} <= actions


def test_football_goalkeeper_clean_sheet_and_saves_score(monkeypatch):
    # The regression that scored 0 under the old formula: a keeper with a clean
    # sheet + saves now earns. appearance 2 + clean_sheet 4 + saves(6//3=2) = 8.
    monkeypatch.setattr(player_scoring, "redis_lock", _no_redis_lock)
    with session_scope() as db:
        sport = _sport(db, "football")
        _seed_football_rules(db, sport)
        rt = RealTeam(sport_id=sport.id, name="Club A", external_api_id="rt:a")
        db.add(rt)
        db.flush()
        window = _window(db, sport)
        gk = _player(db, sport, rt, name="Keeper")
        gk.position = "GKP"
        db.flush()
        base = _base_stat(db, gk, window)
        db.add(FootballStat(base_stat_id=base.id, clean_sheets=1, saves=6, goals=0, assists=0))
        db.commit()

        score_football_players_for_window(db, sport_id=sport.id, transfer_window_id=window.id)
        db.commit()

        db.refresh(base)
        assert base.fantasy_points == Decimal("8.00")


def test_cricket_scoring_is_zero_without_any_default_scoring_rule(monkeypatch):
    # CRICKET_ACTIONS has no Python-side fallback dict (unlike football) — if
    # nobody has seeded DefaultScoringRule rows for a sport, every action
    # resolves to 0 and raw stats are silently ignored. Real gap, worth
    # pinning explicitly rather than discovering it in production.
    monkeypatch.setattr(player_scoring, "redis_lock", _no_redis_lock)
    with session_scope() as db:
        sport = _sport(db, "cricket")
        rt = RealTeam(sport_id=sport.id, name="Club A", external_api_id="rt:a")
        db.add(rt)
        db.flush()
        window = _window(db, sport)
        player = _player(db, sport, rt)
        base = _base_stat(db, player, window)
        db.add(CricketStat(base_stat_id=base.id, runs_scored=100, wickets_taken=3, catches=2, run_outs=1, maidens=1))
        db.commit()

        score_cricket_players_for_window(db, sport_id=sport.id, transfer_window_id=window.id)
        db.commit()

        db.refresh(base)
        assert base.fantasy_points == Decimal("0.00")


def test_cricket_scoring_applies_seeded_default_rules_to_raw_stats(monkeypatch):
    monkeypatch.setattr(player_scoring, "redis_lock", _no_redis_lock)
    with session_scope() as db:
        sport = _sport(db, "cricket")
        rt = RealTeam(sport_id=sport.id, name="Club A", external_api_id="rt:a")
        db.add(rt)
        db.flush()
        window = _window(db, sport)
        player = _player(db, sport, rt)
        base = _base_stat(db, player, window)
        db.add(CricketStat(base_stat_id=base.id, runs_scored=50, wickets_taken=1, catches=2, run_outs=1, maidens=0))
        db.add_all([
            DefaultScoringRule(sport_id=sport.id, action="cricket_run", points=Decimal("0.5"), description="test"),
            DefaultScoringRule(sport_id=sport.id, action="cricket_wicket", points=Decimal("25"), description="test"),
            DefaultScoringRule(sport_id=sport.id, action="cricket_catch", points=Decimal("8"), description="test"),
            DefaultScoringRule(sport_id=sport.id, action="cricket_run_out", points=Decimal("6"), description="test"),
        ])
        db.commit()

        score_cricket_players_for_window(db, sport_id=sport.id, transfer_window_id=window.id)
        db.commit()

        db.refresh(base)
        # 50*0.5 + 1*25 + 2*8 + 1*6 = 25 + 25 + 16 + 6 = 72
        assert base.fantasy_points == Decimal("72.00")


def test_nba_scoring_applies_seeded_default_rules_including_per_10_fractions(monkeypatch):
    monkeypatch.setattr(player_scoring, "redis_lock", _no_redis_lock)
    with session_scope() as db:
        sport = _sport(db, "basketball")
        rt = RealTeam(sport_id=sport.id, name="Club A", external_api_id="rt:a")
        db.add(rt)
        db.flush()
        window = _window(db, sport)
        player = _player(db, sport, rt)
        base = _base_stat(db, player, window)
        db.add(NBAStat(base_stat_id=base.id, points=20, assists=10, rebounds=5, steals=2, blocks=1))
        db.add_all([
            DefaultScoringRule(sport_id=sport.id, action="nba_points_10", points=Decimal("1"), description="test"),
            DefaultScoringRule(sport_id=sport.id, action="nba_assists_10", points=Decimal("1.5"), description="test"),
            DefaultScoringRule(sport_id=sport.id, action="nba_rebound", points=Decimal("1.2"), description="test"),
            DefaultScoringRule(sport_id=sport.id, action="nba_steal", points=Decimal("3"), description="test"),
            DefaultScoringRule(sport_id=sport.id, action="nba_block", points=Decimal("3"), description="test"),
        ])
        db.commit()

        score_nba_players_for_window(db, sport_id=sport.id, transfer_window_id=window.id)
        db.commit()

        db.refresh(base)
        # (20/10)*1 + (10/10)*1.5 + 5*1.2 + 2*3 + 1*3 = 2+1.5+6+6+3 = 18.5
        assert base.fantasy_points == Decimal("18.50")


def test_football_scoring_only_touches_the_targeted_window(monkeypatch):
    monkeypatch.setattr(player_scoring, "redis_lock", _no_redis_lock)
    with session_scope() as db:
        sport = _sport(db, "football")
        _seed_football_rules(db, sport)
        rt = RealTeam(sport_id=sport.id, name="Club A", external_api_id="rt:a")
        db.add(rt)
        db.flush()
        window_a = _window(db, sport)
        window_b = _window(db, sport)
        player = _player(db, sport, rt)  # MID
        base_a = _base_stat(db, player, window_a)
        db.flush()
        player_b = _player(db, sport, rt, name="P2")
        base_b = _base_stat(db, player_b, window_b)
        db.add(FootballStat(base_stat_id=base_a.id, goals=1, assists=0, yellow_cards=0, red_cards=0))
        db.add(FootballStat(base_stat_id=base_b.id, goals=1, assists=0, yellow_cards=0, red_cards=0))
        db.commit()

        updated = score_football_players_for_window(db, sport_id=sport.id, transfer_window_id=window_a.id)
        db.commit()

        assert updated == 1
        db.refresh(base_a)
        db.refresh(base_b)
        # MID: appearance(90') 2 + goal 5 = 7
        assert base_a.fantasy_points == Decimal("7.00")
        assert base_b.fantasy_points == Decimal("0.00")

"""Per-match scoring layer (Phase 2): a player's window total is the SUM of
their PlayerMatchScore rows — so two matches in one gameweek window add up
(the old window-aggregate FootballStat overwrote the first), and the batch
scorer aggregates the per-match scores into PlayerGameweekStat.
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

_temp_dir = tempfile.mkdtemp(prefix="sporty-permatch-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'permatch.db'}"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["JWT_SECRET_KEY"] = "x" * 32
os.environ["GOOGLE_CLIENT_ID"] = "test-client"

_backend_root = Path(__file__).resolve().parents[1]
os.chdir(_temp_dir)
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from contextlib import contextmanager as _cm  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from app.database import Base  # noqa: E402
import app.auth.models  # noqa: F401,E402
from app.match.models import Match  # noqa: E402
from app.league.models import Season, Sport, TransferWindow  # noqa: E402
from app.player.models import FootballStat, Player, PlayerGameweekStat, RealTeam  # noqa: E402
import app.player.models_nba  # noqa: F401,E402
from app.scoring.models import DefaultScoringRule, PlayerMatchScore  # noqa: E402
import app.services.scoring.player_scoring as player_scoring  # noqa: E402
from app.services.scoring.player_scoring import load_football_rules, score_football_players_for_window  # noqa: E402
from app.services.scoring.match_scoring import (  # noqa: E402
    award_match_bonus, rescore_window_match_scores, upsert_player_match_score,
)

ENGINE = create_engine(os.environ["DATABASE_URL"])
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=ENGINE)


@_cm
def _no_redis_lock(*a, **k):
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


def _setup(db):
    sport = Sport(name="football", display_name="Football")
    db.add(sport)
    db.flush()
    for action, position, mode, param, pts in [
        ("appearance", None, "threshold", 1, 1),
        ("appearance_full", None, "threshold", 60, 1),
        ("goal", "MID", "per_unit", None, 5),
        ("assist", None, "per_unit", None, 3),
    ]:
        db.add(DefaultScoringRule(sport_id=sport.id, action=action, position=position,
               mode=mode, param=(Decimal(param) if param is not None else None),
               points=Decimal(pts), description="x"))
    season = Season(sport_id=sport.id, name="S", start_date=date(2026, 1, 1), end_date=date(2027, 1, 1))
    db.add(season)
    db.flush()
    now = datetime.now(timezone.utc)
    window = TransferWindow(season_id=season.id, number=1, start_at=now - timedelta(days=7),
                            end_at=now - timedelta(days=1), transfer_deadline_at=now - timedelta(days=8),
                            lineup_deadline_at=now - timedelta(days=7))
    db.add(window)
    rt = RealTeam(sport_id=sport.id, name="Club", external_api_id="rt")
    db.add(rt)
    db.flush()
    player = Player(sport_id=sport.id, external_api_id=f"p:{uuid.uuid4().hex[:8]}", name="P",
                    position="MID", real_team=rt.name, real_team_id=rt.id, cost=Decimal("5"), is_available=True)
    db.add(player)
    db.flush()
    return sport, window, player


def _match(db, sport):
    m = Match(sport_id=sport.id, external_api_id=f"m:{uuid.uuid4().hex[:8]}", home_team="A",
              away_team="B", match_date=datetime.now(timezone.utc) - timedelta(days=3),
              status="finished", competition="Premier League", season="2026")
    db.add(m)
    db.flush()
    return m


def test_two_matches_in_one_window_sum(monkeypatch):
    monkeypatch.setattr(player_scoring, "redis_lock", _no_redis_lock)
    with session_scope() as db:
        sport, window, player = _setup(db)
        rules = load_football_rules(db, sport.id)
        m1, m2 = _match(db, sport), _match(db, sport)
        # match 1: 90', 1 goal -> 2 + 5 = 7 ; match 2: 90', 1 assist -> 2 + 3 = 5
        upsert_player_match_score(db, player_id=player.id, match_id=m1.id,
                                  position="MID", minutes=90, stats={"minutes": 90, "goals": 1}, rules=rules)
        upsert_player_match_score(db, player_id=player.id, match_id=m2.id,
                                  position="MID", minutes=90, stats={"minutes": 90, "assists": 1}, rules=rules)
        db.commit()

        agg = rescore_window_match_scores(db, window=window, rules=rules)
        assert agg[player.id].total == Decimal(12)  # 7 + 5 — both counted, not overwritten
        # 3 entries/match (appearance + appearance_full + goal/assist) × 2 matches
        assert len(agg[player.id].breakdown) == 6
        # minutes and metric counts sum too — the rollup's FootballStat child
        assert agg[player.id].minutes == 180
        assert agg[player.id].stats["goals"] == 1
        assert agg[player.id].stats["assists"] == 1


def test_batch_scorer_aggregates_match_scores_into_window(monkeypatch):
    monkeypatch.setattr(player_scoring, "redis_lock", _no_redis_lock)
    with session_scope() as db:
        sport, window, player = _setup(db)
        rules = load_football_rules(db, sport.id)
        m1, m2 = _match(db, sport), _match(db, sport)
        upsert_player_match_score(db, player_id=player.id, match_id=m1.id,
                                  position="MID", minutes=90, stats={"minutes": 90, "goals": 1}, rules=rules)
        upsert_player_match_score(db, player_id=player.id, match_id=m2.id,
                                  position="MID", minutes=90, stats={"minutes": 90, "assists": 1}, rules=rules)
        # a PGS + FootballStat must exist for the window (booked alongside)
        pgs = PlayerGameweekStat(player_id=player.id, transfer_window_id=window.id, minutes_played=90)
        db.add(pgs)
        db.flush()
        db.add(FootballStat(base_stat_id=pgs.id, goals=1, assists=1))  # window aggregate (would give wrong total alone)
        db.commit()

        score_football_players_for_window(db, sport_id=sport.id, transfer_window_id=window.id)
        db.commit()
        db.refresh(pgs)
        # Aggregated from the two match scores (7+5=12), NOT the single-window
        # FootballStat compute (which would be appearance 2 + goal 5 + assist 3 = 10).
        assert pgs.fantasy_points == Decimal(12)


def test_bonus_points_awarded_3_2_1_by_bps(monkeypatch):
    monkeypatch.setattr(player_scoring, "redis_lock", _no_redis_lock)
    with session_scope() as db:
        sport, window, p1 = _setup(db)
        rules = load_football_rules(db, sport.id)
        # two more players in the same match
        rt_id = p1.real_team_id
        p2 = Player(sport_id=sport.id, external_api_id="p2", name="P2", position="MID",
                    real_team="Club", real_team_id=rt_id, cost=Decimal("5"), is_available=True)
        p3 = Player(sport_id=sport.id, external_api_id="p3", name="P3", position="MID",
                    real_team="Club", real_team_id=rt_id, cost=Decimal("5"), is_available=True)
        db.add_all([p2, p3])
        db.flush()
        m = _match(db, sport)
        # p1 best (2 goals), p2 middle (1 goal), p3 least (just plays)
        upsert_player_match_score(db, player_id=p1.id, match_id=m.id,
                                  position="MID", minutes=90, stats={"minutes": 90, "goals": 2}, rules=rules)
        upsert_player_match_score(db, player_id=p2.id, match_id=m.id,
                                  position="MID", minutes=90, stats={"minutes": 90, "goals": 1}, rules=rules)
        upsert_player_match_score(db, player_id=p3.id, match_id=m.id,
                                  position="MID", minutes=90, stats={"minutes": 90}, rules=rules)
        db.commit()

        award_match_bonus(db, match_id=m.id)
        db.commit()

        def bonus(pid):
            return db.query(PlayerMatchScore).filter(
                PlayerMatchScore.player_id == pid, PlayerMatchScore.match_id == m.id
            ).first().bonus_points

        assert bonus(p1.id) == Decimal(3)
        assert bonus(p2.id) == Decimal(2)
        assert bonus(p3.id) == Decimal(1)

        # bonus flows into the window total: p1 = appearance 2 + goal*2 10 + bonus 3 = 15
        agg = rescore_window_match_scores(db, window=window, rules=rules)
        assert agg[p1.id].total == Decimal(15)


if __name__ == "__main__":
    pass

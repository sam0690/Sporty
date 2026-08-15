"""Pin the multisport window-translation fix in the scoring engine.

A multisport league's lineups and TeamWeeklyScore rows live only under its
own season's windows (league.season_id points at ONE sport's schedule). The
scoring sweep reaches a multisport league once per sport it plays, handing
score_transfer_window_for_league each sport's window id. Before the fix it
scored the league under foreign-sport window ids verbatim, writing phantom
0-point TeamWeeklyScore rows: duplicate gameweek bars on the dashboard and
everyone-ranks-#1 rows polluting power rankings.

These tests assert the translation contract: downstream scoring only ever
receives the league-native window id, and a foreign window with no native
equivalent is skipped entirely.
"""
from __future__ import annotations

import os
import tempfile
import uuid
from contextlib import contextmanager
from datetime import date, datetime, timezone
from pathlib import Path
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_temp_dir = tempfile.mkdtemp(prefix="sporty-window-translation-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'translation.db'}"
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
from app.league.models import (
    League,
    LeagueSport,
    LeagueStatus,
    Season,
    Sport,
    TransferWindow,
)
from app.league.schemas import LeagueCreate
from app.services.scoring import engine as scoring_engine

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


@contextmanager
def _fake_redis_lock(*args, **kwargs):
    yield True


def _create_user(db) -> User:
    user = User(
        username=f"owner-{uuid.uuid4().hex[:8]}",
        email=f"{uuid.uuid4().hex[:8]}@example.com",
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
        start_date=date(2026, 1, 1),
        end_date=date(2026, 12, 31),
        is_active=True,
    )
    db.add(season)
    db.flush()
    return season


def _create_window(
    db, season: Season, *, number: int, start: datetime
) -> TransferWindow:
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


def _setup_mixed_league(db) -> tuple[League, TransferWindow, TransferWindow]:
    """Mixed football+basketball league whose native season is football's.

    Returns (league, native GW6 window, foreign GW6 window) where both
    windows cover the identical date range — the equivalence the engine's
    window locator matches on.
    """
    football = Sport(name="football", display_name="Football")
    basketball = Sport(name="basketball", display_name="Basketball")
    db.add_all([football, basketball])
    db.flush()

    football_season = _create_season(db, football)
    basketball_season = _create_season(db, basketball)

    gw6_start = datetime(2026, 2, 7, tzinfo=timezone.utc)
    native_window = _create_window(db, football_season, number=6, start=gw6_start)
    foreign_window = _create_window(db, basketball_season, number=6, start=gw6_start)

    owner = _create_user(db)
    league = league_service.create_league(
        db,
        LeagueCreate(
            name=f"Mixed-{uuid.uuid4().hex[:8]}",
            season_id=football_season.id,
            draft_mode=False,
            sports=["football", "basketball"],
        ),
        owner,
    )
    league.status = LeagueStatus.ACTIVE
    db.flush()
    return league, native_window, foreign_window


def _capture_scoring_calls(monkeypatch) -> list[uuid.UUID]:
    """Stub everything downstream of the translation; record the window id
    each scoring call receives."""
    seen: list[uuid.UUID] = []

    def fake_upsert(db, *, league_id, transfer_window_id):
        seen.append(transfer_window_id)
        return 0

    monkeypatch.setattr(scoring_engine, "redis_lock", _fake_redis_lock)
    monkeypatch.setattr(scoring_engine, "upsert_team_weekly_scores", fake_upsert)
    monkeypatch.setattr(
        scoring_engine,
        "apply_rankings_for_league_window",
        lambda db, *, league_id, transfer_window_id: None,
    )
    monkeypatch.setattr(scoring_engine.read_cache, "bust_league", lambda league_id: None)
    monkeypatch.setattr(scoring_engine.player_read_cache, "bust_all", lambda: None)
    return seen


def test_foreign_sport_window_is_translated_to_native(monkeypatch) -> None:
    with session_scope() as db:
        league, native_window, foreign_window = _setup_mixed_league(db)
        seen = _capture_scoring_calls(monkeypatch)

        result = scoring_engine.score_transfer_window_for_league(
            db, league_id=league.id, transfer_window_id=foreign_window.id
        )

        assert result == {}
        assert seen == [native_window.id]


def test_native_window_passes_through_unchanged(monkeypatch) -> None:
    with session_scope() as db:
        league, native_window, _ = _setup_mixed_league(db)
        seen = _capture_scoring_calls(monkeypatch)

        result = scoring_engine.score_transfer_window_for_league(
            db, league_id=league.id, transfer_window_id=native_window.id
        )

        assert result == {}
        assert seen == [native_window.id]


def test_foreign_window_without_native_equivalent_is_skipped(monkeypatch) -> None:
    with session_scope() as db:
        league, _, _ = _setup_mixed_league(db)
        seen = _capture_scoring_calls(monkeypatch)

        # A basketball week with no football window covering the same dates
        # (e.g. football's off week) — nothing legitimate to score.
        basketball_season = (
            db.query(Season)
            .join(Sport, Sport.id == Season.sport_id)
            .filter(Sport.name == "basketball")
            .one()
        )
        lonely_window = _create_window(
            db,
            basketball_season,
            number=7,
            start=datetime(2026, 2, 14, tzinfo=timezone.utc),
        )

        result = scoring_engine.score_transfer_window_for_league(
            db, league_id=league.id, transfer_window_id=lonely_window.id
        )

        assert result == {"skipped": True, "reason": "no_native_window"}
        assert seen == []


def test_two_leagues_mapping_same_sport_to_different_seasons_each_scored_once(monkeypatch) -> None:
    """Two multisport leagues share this football window but map basketball
    to DIFFERENT basketball seasons (LeagueSport.season_id) — confirms
    _score_player_stats_once_per_sport dedupes by (sport, RESOLVED window),
    not by sport alone, so both leagues' basketball players get scored under
    their own league's correct window rather than one clobbering the other."""
    with session_scope() as db:
        football = Sport(name="football", display_name="Football")
        basketball = Sport(name="basketball", display_name="Basketball")
        db.add_all([football, basketball])
        db.flush()

        football_season = _create_season(db, football)
        # Two independent basketball seasons — different start_date so they
        # don't collide on uq_season_sport_start, both still covering "today"
        # so create_league's current-season auto-resolution can pick either.
        basketball_season_a = Season(
            sport_id=basketball.id, name=f"BBall-A-{uuid.uuid4().hex[:8]}",
            start_date=date(2026, 1, 1), end_date=date(2026, 12, 31), is_active=True,
        )
        basketball_season_b = Season(
            sport_id=basketball.id, name=f"BBall-B-{uuid.uuid4().hex[:8]}",
            start_date=date(2026, 1, 2), end_date=date(2026, 12, 30), is_active=True,
        )
        db.add_all([basketball_season_a, basketball_season_b])
        db.flush()

        gw6_start = datetime(2026, 2, 7, tzinfo=timezone.utc)
        football_window = _create_window(db, football_season, number=6, start=gw6_start)
        basketball_window_a = _create_window(db, basketball_season_a, number=6, start=gw6_start)
        basketball_window_b = _create_window(db, basketball_season_b, number=6, start=gw6_start)

        owner_a = _create_user(db)
        owner_b = _create_user(db)
        league_a = league_service.create_league(
            db, LeagueCreate(name=f"A-{uuid.uuid4().hex[:8]}", season_id=football_season.id,
                              draft_mode=False, sports=["football", "basketball"]), owner_a,
        )
        league_b = league_service.create_league(
            db, LeagueCreate(name=f"B-{uuid.uuid4().hex[:8]}", season_id=football_season.id,
                              draft_mode=False, sports=["football", "basketball"]), owner_b,
        )
        db.flush()

        # Force each league onto a distinct basketball season explicitly —
        # auto-resolution at creation could have picked either for both,
        # this is what makes the divergence deterministic for the test.
        for league, target_season in ((league_a, basketball_season_a), (league_b, basketball_season_b)):
            league_sport = (
                db.query(LeagueSport)
                .filter(LeagueSport.league_id == league.id, LeagueSport.sport_id == basketball.id)
                .first()
            )
            league_sport.season_id = target_season.id
        db.flush()

        calls: list[uuid.UUID] = []

        def fake_score_nba(db, *, sport_id, transfer_window_id):
            calls.append(transfer_window_id)
            return 0

        monkeypatch.setattr(scoring_engine, "score_nba_players_for_window", fake_score_nba)
        monkeypatch.setattr(scoring_engine, "score_football_players_for_window", lambda db, **kw: 0)

        totals = scoring_engine._score_player_stats_once_per_sport(
            db, league_ids=[league_a.id, league_b.id], window=football_window,
        )

        assert sorted(calls) == sorted([basketball_window_a.id, basketball_window_b.id])
        assert totals["leagues_skipped_no_equivalent_season"] == 0

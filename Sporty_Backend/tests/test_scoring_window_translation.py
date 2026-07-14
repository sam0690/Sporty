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
    monkeypatch.setattr(scoring_engine, "cache_delete", lambda key: None)
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

"""get_league_sport_season / find_equivalent_window_for_sport — the explicit
per-league cross-sport mapping that replaced exact date-equality inference.
SQLite throwaway DB, same pattern as test_league_status_service.py."""
from __future__ import annotations

import os
import sys
import tempfile
import uuid
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_temp_dir = tempfile.mkdtemp(prefix="sporty-window-locator-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'windowlocator.db'}"
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
from app.league.models import League, LeagueSport, Season, Sport, TransferWindow
from app.league.schemas import LeagueCreate
from app.services.scoring.window_locator import (
    find_equivalent_window_for_sport,
    get_league_sport_season,
)

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


def _user(db) -> User:
    u = User(
        username=f"u-{uuid.uuid4().hex[:8]}", email=f"{uuid.uuid4().hex[:8]}@example.com",
        auth_provider=AuthProvider.LOCAL, password_hash="h",
    )
    db.add(u)
    db.flush()
    return u


def _season(db, sport: Sport, *, start: date, end: date) -> Season:
    season = Season(
        sport_id=sport.id, name=f"S-{uuid.uuid4().hex[:8]}",
        start_date=start, end_date=end, is_active=True,
    )
    db.add(season)
    db.flush()
    return season


def _window(db, season: Season, *, number: int, start: datetime, days: int = 1) -> TransferWindow:
    end = start + timedelta(days=days) - timedelta(seconds=1)
    w = TransferWindow(
        season_id=season.id, number=number, start_at=start, end_at=end,
        transfer_deadline_at=start, lineup_deadline_at=start + timedelta(minutes=1),
    )
    db.add(w)
    db.flush()
    return w


def _mixed_league(db, *, football_season: Season, basketball_season: Season) -> League:
    owner = _user(db)
    league = league_service.create_league(
        db, LeagueCreate(name=f"L-{uuid.uuid4().hex[:8]}", season_id=football_season.id,
                          draft_mode=False, sports=["football", "basketball"]), owner,
    )
    db.flush()
    league_sport = (
        db.query(LeagueSport)
        .filter(LeagueSport.league_id == league.id, LeagueSport.sport_id == basketball_season.sport_id)
        .first()
    )
    league_sport.season_id = basketball_season.id
    db.flush()
    return league


def test_get_league_sport_season_short_circuits_on_primary_sport():
    with session_scope() as db:
        football = Sport(name="football", display_name="Football")
        basketball = Sport(name="basketball", display_name="Basketball")
        db.add_all([football, basketball])
        db.flush()

        today = date.today()
        football_season = _season(db, football, start=today - timedelta(days=30), end=today + timedelta(days=200))
        basketball_season = _season(db, basketball, start=today - timedelta(days=30), end=today + timedelta(days=200))
        league = _mixed_league(db, football_season=football_season, basketball_season=basketball_season)
        db.commit()

        resolved = get_league_sport_season(db, league_id=league.id, sport_id=football.id)
        assert resolved.id == football_season.id


def test_get_league_sport_season_reads_explicit_mapping_for_secondary_sport():
    with session_scope() as db:
        football = Sport(name="football", display_name="Football")
        basketball = Sport(name="basketball", display_name="Basketball")
        db.add_all([football, basketball])
        db.flush()

        today = date.today()
        football_season = _season(db, football, start=today - timedelta(days=30), end=today + timedelta(days=200))
        basketball_season = _season(db, basketball, start=today - timedelta(days=30), end=today + timedelta(days=200))
        league = _mixed_league(db, football_season=football_season, basketball_season=basketball_season)
        db.commit()

        resolved = get_league_sport_season(db, league_id=league.id, sport_id=basketball.id)
        assert resolved.id == basketball_season.id


def test_find_equivalent_window_for_sport_handles_different_weekly_cadence():
    """Football generates Monday windows, basketball (once correctly
    mapped) generates Wednesday windows -- exact start_at/end_at equality
    would never match these; the covering-date lookup should."""
    with session_scope() as db:
        football = Sport(name="football", display_name="Football")
        basketball = Sport(name="basketball", display_name="Basketball")
        db.add_all([football, basketball])
        db.flush()

        today = date.today()
        football_season = _season(db, football, start=today - timedelta(days=30), end=today + timedelta(days=200))
        basketball_season = _season(db, basketball, start=today - timedelta(days=30), end=today + timedelta(days=200))
        league = _mixed_league(db, football_season=football_season, basketball_season=basketball_season)

        # Football: Monday Feb 2 2026. Basketball: Wednesday Feb 4 2026,
        # a 3-day window covering the football Monday's date range.
        football_window = _window(db, football_season, number=6, start=datetime(2026, 2, 2, tzinfo=timezone.utc))
        basketball_window = _window(
            db, basketball_season, number=6, start=datetime(2026, 2, 2, tzinfo=timezone.utc), days=3,
        )
        db.commit()

        equivalent = find_equivalent_window_for_sport(
            db, league_id=league.id, window=football_window, sport_id=basketball.id,
        )
        assert equivalent is not None
        assert equivalent.id == basketball_window.id


def test_find_equivalent_window_for_sport_same_sport_short_circuits():
    with session_scope() as db:
        football = Sport(name="football", display_name="Football")
        db.add(football)
        db.flush()
        today = date.today()
        season = _season(db, football, start=today - timedelta(days=30), end=today + timedelta(days=200))
        owner = _user(db)
        league = league_service.create_league(
            db, LeagueCreate(name=f"L-{uuid.uuid4().hex[:8]}", season_id=season.id,
                              draft_mode=False, sports=["football"]), owner,
        )
        window = _window(db, season, number=1, start=datetime(2026, 2, 2, tzinfo=timezone.utc))
        db.commit()

        equivalent = find_equivalent_window_for_sport(
            db, league_id=league.id, window=window, sport_id=football.id,
        )
        assert equivalent is window


def test_find_equivalent_window_for_sport_returns_none_without_mapping():
    """A LeagueSport row that predates the mapping (season_id still NULL,
    the pre-migration/pre-backfill case) resolves to nothing, not a guess."""
    with session_scope() as db:
        football = Sport(name="football", display_name="Football")
        basketball = Sport(name="basketball", display_name="Basketball")
        db.add_all([football, basketball])
        db.flush()
        today = date.today()
        football_season = _season(db, football, start=today - timedelta(days=30), end=today + timedelta(days=200))
        basketball_season = _season(db, basketball, start=today - timedelta(days=30), end=today + timedelta(days=200))

        owner = _user(db)
        league = league_service.create_league(
            db, LeagueCreate(name=f"L-{uuid.uuid4().hex[:8]}", season_id=football_season.id,
                              draft_mode=False, sports=["football", "basketball"]), owner,
        )
        db.flush()
        # Simulate a stale pre-migration row.
        league_sport = (
            db.query(LeagueSport)
            .filter(LeagueSport.league_id == league.id, LeagueSport.sport_id == basketball.id)
            .first()
        )
        league_sport.season_id = None
        db.flush()

        window = _window(db, football_season, number=1, start=datetime(2026, 2, 2, tzinfo=timezone.utc))
        db.commit()

        equivalent = find_equivalent_window_for_sport(
            db, league_id=league.id, window=window, sport_id=basketball.id,
        )
        assert equivalent is None

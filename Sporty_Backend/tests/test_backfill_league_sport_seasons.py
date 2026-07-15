"""scripts/backfill_league_sport_seasons.py's core resolution logic —
dry-run leaves the DB untouched, a real run only fills NULL season_id rows,
and rows with no current season to resolve are left alone (not guessed at).

Runs the script's per-row resolution logic directly against a session
(same approach as importing the script's module would take) rather than
shelling out, since the script's DB connection is built from DATABASE_URL
at import time — this exercises the identical code path
(_current_season_for_sport) it delegates to."""
from __future__ import annotations

import os
import sys
import tempfile
import uuid
from contextlib import contextmanager
from datetime import date, timedelta
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_temp_dir = tempfile.mkdtemp(prefix="sporty-backfill-league-sport-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'backfill.db'}"
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
from app.league.league_service import _current_season_for_sport
from app.league.models import LeagueSport, Season, Sport
from app.league.schemas import LeagueCreate

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


def _current_season(db, sport: Sport) -> Season:
    today = date.today()
    season = Season(
        sport_id=sport.id, name=f"S-{uuid.uuid4().hex[:8]}",
        start_date=today - timedelta(days=30), end_date=today + timedelta(days=200), is_active=True,
    )
    db.add(season)
    db.flush()
    return season


def _pre_migration_mixed_league(db, football: Sport, basketball: Sport, football_season: Season):
    """A league created before the season-mapping backfill — its basketball
    LeagueSport row has season_id=None, simulating pre-existing data."""
    owner = _user(db)
    league = league_service.create_league(
        db, LeagueCreate(name=f"L-{uuid.uuid4().hex[:8]}", season_id=football_season.id,
                          draft_mode=False, sports=["football", "basketball"]), owner,
    )
    db.flush()
    league_sport = (
        db.query(LeagueSport)
        .filter(LeagueSport.league_id == league.id, LeagueSport.sport_id == basketball.id)
        .first()
    )
    league_sport.season_id = None
    db.flush()
    return league, league_sport


def _run_backfill(db, *, dry_run: bool) -> tuple[int, int]:
    """Mirrors scripts/backfill_league_sport_seasons.py's main loop exactly,
    against the given session, so the test doesn't need a subprocess."""
    unmapped = db.query(LeagueSport).filter(LeagueSport.season_id.is_(None)).all()
    resolved = 0
    unresolved = 0
    for league_sport in unmapped:
        current_season = _current_season_for_sport(db, league_sport.sport_id)
        if current_season is None:
            unresolved += 1
            continue
        resolved += 1
        if not dry_run:
            league_sport.season_id = current_season.id
    if dry_run:
        db.rollback()
    else:
        db.commit()
    return resolved, unresolved


def test_dry_run_leaves_season_id_null():
    with session_scope() as db:
        football = Sport(name="football", display_name="Football")
        basketball = Sport(name="basketball", display_name="Basketball")
        db.add_all([football, basketball])
        db.flush()
        football_season = _current_season(db, football)
        basketball_season = _current_season(db, basketball)
        league, league_sport = _pre_migration_mixed_league(db, football, basketball, football_season)
        db.commit()

        resolved, unresolved = _run_backfill(db, dry_run=True)

        assert resolved == 1
        assert unresolved == 0
        db.refresh(league_sport)
        assert league_sport.season_id is None


def test_real_run_fills_season_id():
    with session_scope() as db:
        football = Sport(name="football", display_name="Football")
        basketball = Sport(name="basketball", display_name="Basketball")
        db.add_all([football, basketball])
        db.flush()
        football_season = _current_season(db, football)
        basketball_season = _current_season(db, basketball)
        league, league_sport = _pre_migration_mixed_league(db, football, basketball, football_season)
        db.commit()

        resolved, unresolved = _run_backfill(db, dry_run=False)

        assert resolved == 1
        assert unresolved == 0
        db.refresh(league_sport)
        assert league_sport.season_id == basketball_season.id


def test_only_touches_null_rows_leaves_already_mapped_ones_alone():
    with session_scope() as db:
        football = Sport(name="football", display_name="Football")
        basketball = Sport(name="basketball", display_name="Basketball")
        db.add_all([football, basketball])
        db.flush()
        football_season = _current_season(db, football)
        basketball_season = _current_season(db, basketball)
        owner = _user(db)
        # Created via the normal path -- already mapped, nothing to backfill.
        league = league_service.create_league(
            db, LeagueCreate(name="Mixed", season_id=football_season.id,
                              draft_mode=False, sports=["football", "basketball"]), owner,
        )
        db.commit()

        resolved, unresolved = _run_backfill(db, dry_run=False)

        assert resolved == 0
        assert unresolved == 0


def test_skips_rows_with_no_current_season_to_resolve():
    with session_scope() as db:
        football = Sport(name="football", display_name="Football")
        basketball = Sport(name="basketball", display_name="Basketball")
        db.add_all([football, basketball])
        db.flush()
        football_season = _current_season(db, football)
        owner = _user(db)
        # create_league itself would now block attaching basketball with no
        # current season -- simulate genuinely pre-migration data (created
        # before that guard existed) by inserting the row directly instead.
        league = league_service.create_league(
            db, LeagueCreate(name="Football-only", season_id=football_season.id,
                              draft_mode=False, sports=["football"]), owner,
        )
        db.flush()
        stale_league_sport = LeagueSport(league_id=league.id, sport_id=basketball.id, season_id=None)
        db.add(stale_league_sport)
        db.commit()
        # No basketball season exists anywhere -- nothing to resolve to.

        resolved, unresolved = _run_backfill(db, dry_run=False)

        assert resolved == 0
        assert unresolved == 1
        db.refresh(stale_league_sport)
        assert stale_league_sport.season_id is None

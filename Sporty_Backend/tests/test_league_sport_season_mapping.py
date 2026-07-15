"""create_league / add_sport: secondary sports must resolve a current
season (LeagueSport.season_id) or be hard-blocked (409) — no more creating
a league (or attaching a sport) with a dangling, unmapped cross-sport
scoring relationship. SQLite throwaway DB, same pattern as
test_league_status_service.py."""
from __future__ import annotations

import os
import sys
import tempfile
import uuid
from contextlib import contextmanager
from datetime import date, timedelta
from pathlib import Path

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_temp_dir = tempfile.mkdtemp(prefix="sporty-league-sport-season-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'lssm.db'}"
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


def test_create_league_blocks_secondary_sport_with_no_current_season():
    with session_scope() as db:
        football = Sport(name="football", display_name="Football")
        basketball = Sport(name="basketball", display_name="Basketball")
        db.add_all([football, basketball])
        db.flush()
        football_season = _current_season(db, football)
        # No basketball season at all.
        owner = _user(db)
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            league_service.create_league(
                db, LeagueCreate(name="Mixed", season_id=football_season.id,
                                  draft_mode=False, sports=["football", "basketball"]), owner,
            )
        assert exc_info.value.status_code == 409
        assert "basketball" in exc_info.value.detail.lower()


def test_create_league_succeeds_and_maps_secondary_sport_when_current_season_exists():
    with session_scope() as db:
        football = Sport(name="football", display_name="Football")
        basketball = Sport(name="basketball", display_name="Basketball")
        db.add_all([football, basketball])
        db.flush()
        football_season = _current_season(db, football)
        basketball_season = _current_season(db, basketball)
        owner = _user(db)
        db.commit()

        league = league_service.create_league(
            db, LeagueCreate(name="Mixed", season_id=football_season.id,
                              draft_mode=False, sports=["football", "basketball"]), owner,
        )
        db.flush()

        basketball_mapping = (
            db.query(LeagueSport)
            .filter(LeagueSport.league_id == league.id, LeagueSport.sport_id == basketball.id)
            .first()
        )
        assert basketball_mapping.season_id == basketball_season.id


def test_add_sport_blocks_when_no_current_season():
    with session_scope() as db:
        football = Sport(name="football", display_name="Football")
        basketball = Sport(name="basketball", display_name="Basketball")
        db.add_all([football, basketball])
        db.flush()
        football_season = _current_season(db, football)
        owner = _user(db)
        league = league_service.create_league(
            db, LeagueCreate(name="Football League", season_id=football_season.id,
                              draft_mode=False, sports=["football"]), owner,
        )
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            league_service.add_sport(db, league.id, "basketball")
        assert exc_info.value.status_code == 409


def test_add_sport_succeeds_and_maps_season_when_current_season_exists():
    with session_scope() as db:
        football = Sport(name="football", display_name="Football")
        basketball = Sport(name="basketball", display_name="Basketball")
        db.add_all([football, basketball])
        db.flush()
        football_season = _current_season(db, football)
        basketball_season = _current_season(db, basketball)
        owner = _user(db)
        league = league_service.create_league(
            db, LeagueCreate(name="Football League", season_id=football_season.id,
                              draft_mode=False, sports=["football"]), owner,
        )
        db.commit()

        league_service.add_sport(db, league.id, "basketball")
        db.flush()

        reloaded = (
            db.query(LeagueSport)
            .filter(LeagueSport.league_id == league.id, LeagueSport.sport_id == basketball.id)
            .first()
        )
        assert reloaded.season_id == basketball_season.id


def test_remap_sport_season_moves_mapping_to_new_season():
    with session_scope() as db:
        football = Sport(name="football", display_name="Football")
        basketball = Sport(name="basketball", display_name="Basketball")
        db.add_all([football, basketball])
        db.flush()
        football_season = _current_season(db, football)
        basketball_season_old = _current_season(db, basketball)
        owner = _user(db)
        league = league_service.create_league(
            db, LeagueCreate(name="Mixed", season_id=football_season.id,
                              draft_mode=False, sports=["football", "basketball"]), owner,
        )
        db.flush()

        # A new basketball season replaces the old placeholder (dates don't
        # need to be "current" for this -- remap is deliberate, not inferred).
        basketball_season_new = Season(
            sport_id=basketball.id, name="Real Basketball Season",
            start_date=date(2027, 1, 1), end_date=date(2027, 12, 31), is_active=True,
        )
        db.add(basketball_season_new)
        db.commit()

        league_service.remap_sport_season(db, league.id, "basketball", basketball_season_new.id)
        db.flush()

        reloaded = (
            db.query(LeagueSport)
            .filter(LeagueSport.league_id == league.id, LeagueSport.sport_id == basketball.id)
            .first()
        )
        assert reloaded.season_id == basketball_season_new.id
        assert reloaded.season_id != basketball_season_old.id


def test_remap_sport_season_rejects_primary_sport():
    with session_scope() as db:
        football = Sport(name="football", display_name="Football")
        db.add(football)
        db.flush()
        football_season = _current_season(db, football)
        other_football_season = Season(
            sport_id=football.id, name="Other Football Season",
            start_date=date(2027, 1, 1), end_date=date(2027, 12, 31), is_active=True,
        )
        db.add(other_football_season)
        owner = _user(db)
        league = league_service.create_league(
            db, LeagueCreate(name="Football League", season_id=football_season.id,
                              draft_mode=False, sports=["football"]), owner,
        )
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            league_service.remap_sport_season(db, league.id, "football", other_football_season.id)
        assert exc_info.value.status_code == 409


def test_remap_sport_season_rejects_mismatched_sport():
    with session_scope() as db:
        football = Sport(name="football", display_name="Football")
        basketball = Sport(name="basketball", display_name="Basketball")
        db.add_all([football, basketball])
        db.flush()
        football_season = _current_season(db, football)
        basketball_season = _current_season(db, basketball)
        owner = _user(db)
        league = league_service.create_league(
            db, LeagueCreate(name="Mixed", season_id=football_season.id,
                              draft_mode=False, sports=["football", "basketball"]), owner,
        )
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            # football_season.id is NOT a basketball season.
            league_service.remap_sport_season(db, league.id, "basketball", football_season.id)
        assert exc_info.value.status_code == 422


# ── Multisport creation-window gate ──────────────────────────────────────────
#
# Requiring EVERY sport in a multisport league — including the primary one —
# to have a season covering "today" mathematically guarantees all of them
# overlap each other (two ranges containing the same point necessarily
# overlap). These tests close the one gap: without also checking the PRIMARY
# season, a caller could pick a not-yet-current primary season and still
# pass the (already-tested) secondary-sport check above.


def test_create_league_blocks_multisport_with_non_current_primary_season():
    with session_scope() as db:
        football = Sport(name="football", display_name="Football")
        basketball = Sport(name="basketball", display_name="Basketball")
        db.add_all([football, basketball])
        db.flush()
        future_football_season = Season(
            sport_id=football.id, name="Future Football Season",
            start_date=date.today() + timedelta(days=60),
            end_date=date.today() + timedelta(days=300),
            is_active=True,
        )
        db.add(future_football_season)
        basketball_season = _current_season(db, basketball)  # itself current
        owner = _user(db)
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            league_service.create_league(
                db, LeagueCreate(name="Mixed", season_id=future_football_season.id,
                                  draft_mode=False, sports=["football", "basketball"]), owner,
            )
        assert exc_info.value.status_code == 409
        assert "multisport" in exc_info.value.detail.lower()


def test_create_league_allows_multisport_when_primary_and_secondary_both_current():
    with session_scope() as db:
        football = Sport(name="football", display_name="Football")
        basketball = Sport(name="basketball", display_name="Basketball")
        db.add_all([football, basketball])
        db.flush()
        football_season = _current_season(db, football)
        basketball_season = _current_season(db, basketball)
        owner = _user(db)
        db.commit()

        league = league_service.create_league(
            db, LeagueCreate(name="Mixed", season_id=football_season.id,
                              draft_mode=False, sports=["football", "basketball"]), owner,
        )
        assert league.id is not None


def test_create_league_single_sport_allows_non_current_season():
    """The multisport-only gate must not regress ordinary single-sport
    league creation against a future/past season, which has always been
    allowed and stays allowed."""
    with session_scope() as db:
        football = Sport(name="football", display_name="Football")
        db.add(football)
        db.flush()
        future_football_season = Season(
            sport_id=football.id, name="Future Football Season",
            start_date=date.today() + timedelta(days=60),
            end_date=date.today() + timedelta(days=300),
            is_active=True,
        )
        db.add(future_football_season)
        owner = _user(db)
        db.commit()

        league = league_service.create_league(
            db, LeagueCreate(name="Future League", season_id=future_football_season.id,
                              draft_mode=False, sports=["football"]), owner,
        )
        assert league.id is not None


def test_add_sport_blocks_when_league_own_season_not_current():
    with session_scope() as db:
        football = Sport(name="football", display_name="Football")
        basketball = Sport(name="basketball", display_name="Basketball")
        db.add_all([football, basketball])
        db.flush()
        future_football_season = Season(
            sport_id=football.id, name="Future Football Season",
            start_date=date.today() + timedelta(days=60),
            end_date=date.today() + timedelta(days=300),
            is_active=True,
        )
        db.add(future_football_season)
        basketball_season = _current_season(db, basketball)  # itself current
        owner = _user(db)
        league = league_service.create_league(
            db, LeagueCreate(name="Future Football League", season_id=future_football_season.id,
                              draft_mode=False, sports=["football"]), owner,
        )
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            league_service.add_sport(db, league.id, "basketball")
        assert exc_info.value.status_code == 409


def test_add_sport_allows_when_league_own_season_and_new_sport_both_current():
    with session_scope() as db:
        football = Sport(name="football", display_name="Football")
        basketball = Sport(name="basketball", display_name="Basketball")
        db.add_all([football, basketball])
        db.flush()
        football_season = _current_season(db, football)
        basketball_season = _current_season(db, basketball)
        owner = _user(db)
        league = league_service.create_league(
            db, LeagueCreate(name="Football League", season_id=football_season.id,
                              draft_mode=False, sports=["football"]), owner,
        )
        db.commit()

        league_sport = league_service.add_sport(db, league.id, "basketball")
        assert league_sport is not None

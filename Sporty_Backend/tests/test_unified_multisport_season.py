"""Unified multisport season — pins the Phase 2-4 behavior of
docs/UNIFIED_MULTISPORT_SCHEDULE_PLAN.md.

A "unified" season is a real Season with sport_id IS NULL whose dates are the
overlap window of its component sports' seasons. A multisport league points at
it; its lineups/TeamWeeklyScore rows live under the unified season's OWN windows.
Scoring is driven by each COMPONENT sport's window passes, translated onto the
unified window — never by the unified window self-triggering.

SQLite throwaway DB, same pattern as test_scoring_window_translation.py.
"""
from __future__ import annotations

import os
import sys
import tempfile
import uuid
from contextlib import contextmanager
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_temp_dir = tempfile.mkdtemp(prefix="sporty-unified-season-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'unified.db'}"
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
from app.league.models import LeagueSport, LeagueStatus, Season, Sport, TransferWindow
from app.league.schemas import LeagueCreate
from app.services.scoring import engine as scoring_engine
from app.services.scoring.window_locator import get_league_sport_season

ENGINE = create_engine(os.environ["DATABASE_URL"])
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=ENGINE)

TODAY = date.today()


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


def _user(db) -> User:
    u = User(
        username=f"owner-{uuid.uuid4().hex[:8]}",
        email=f"{uuid.uuid4().hex[:8]}@example.com",
        auth_provider=AuthProvider.LOCAL,
        password_hash="h",
    )
    db.add(u)
    db.flush()
    return u


def _season(db, sport, *, start: date, end: date) -> Season:
    s = Season(sport_id=sport.id, name=f"S-{uuid.uuid4().hex[:8]}",
               start_date=start, end_date=end, is_active=True)
    db.add(s)
    db.flush()
    return s


def _unified_season(db, *, start: date, end: date, component_ids) -> Season:
    s = Season(sport_id=None, name=f"U-{uuid.uuid4().hex[:8]}",
               start_date=start, end_date=end, is_active=True,
               component_sport_ids=[str(c) for c in component_ids])
    db.add(s)
    db.flush()
    return s


def _window(db, season, *, number: int, on: date) -> TransferWindow:
    start = datetime.combine(on, time.min, tzinfo=timezone.utc)
    end = start + timedelta(hours=23, minutes=59, seconds=59)
    w = TransferWindow(season_id=season.id, number=number, start_at=start, end_at=end,
                       transfer_deadline_at=start, lineup_deadline_at=start + timedelta(minutes=1))
    db.add(w)
    db.flush()
    return w


def _unified_league(db):
    """football + basketball, both current, overlap contains today. Returns
    (league, unified_season, football_season, basketball_season, football, basketball)."""
    football = Sport(name="football", display_name="Football")
    basketball = Sport(name="basketball", display_name="Basketball")
    db.add_all([football, basketball])
    db.flush()

    fb = _season(db, football, start=TODAY - timedelta(days=60), end=TODAY + timedelta(days=60))
    bb = _season(db, basketball, start=TODAY - timedelta(days=40), end=TODAY + timedelta(days=80))
    overlap_start = max(fb.start_date, bb.start_date)  # later start
    overlap_end = min(fb.end_date, bb.end_date)        # earlier end
    unified = _unified_season(db, start=overlap_start, end=overlap_end,
                              component_ids=[football.id, basketball.id])

    owner = _user(db)
    league = league_service.create_league(
        db,
        LeagueCreate(name=f"U-{uuid.uuid4().hex[:8]}", season_id=unified.id,
                     draft_mode=False, sports=["football", "basketball"]),
        owner,
    )
    league.status = LeagueStatus.ACTIVE
    db.flush()
    return league, unified, fb, bb, football, basketball


def _capture_scoring_calls(monkeypatch) -> list[uuid.UUID]:
    seen: list[uuid.UUID] = []

    def fake_upsert(db, *, league_id, transfer_window_id):
        seen.append(transfer_window_id)
        return 0

    monkeypatch.setattr(scoring_engine, "redis_lock", _fake_redis_lock)
    monkeypatch.setattr(scoring_engine, "upsert_team_weekly_scores", fake_upsert)
    monkeypatch.setattr(scoring_engine, "apply_rankings_for_league_window",
                        lambda db, *, league_id, transfer_window_id: None)
    monkeypatch.setattr(scoring_engine.read_cache, "bust_league", lambda league_id: None)
    monkeypatch.setattr(scoring_engine.player_read_cache, "bust_all", lambda: None)
    return seen


# ── Phase 3: create_league ─────────────────────────────────────────────────

def test_create_league_on_unified_season_maps_each_sport_to_its_own_season():
    with session_scope() as db:
        league, unified, fb, bb, football, basketball = _unified_league(db)
        db.commit()

        assert league.season_id == unified.id
        mappings = {
            ls.sport_id: ls.season_id
            for ls in db.query(LeagueSport).filter(LeagueSport.league_id == league.id)
        }
        # Every sport (no "primary") resolves its OWN real season — never the unified one.
        assert mappings[football.id] == fb.id
        assert mappings[basketball.id] == bb.id
        assert unified.id not in mappings.values()


def test_create_league_on_unified_season_requires_at_least_two_sports():
    with session_scope() as db:
        football = Sport(name="football", display_name="Football")
        basketball = Sport(name="basketball", display_name="Basketball")
        db.add_all([football, basketball])
        db.flush()
        _season(db, football, start=TODAY - timedelta(days=30), end=TODAY + timedelta(days=30))
        _season(db, basketball, start=TODAY - timedelta(days=30), end=TODAY + timedelta(days=30))
        unified = _unified_season(db, start=TODAY - timedelta(days=30), end=TODAY + timedelta(days=30),
                                  component_ids=[football.id, basketball.id])
        owner = _user(db)

        with pytest.raises(HTTPException) as exc:
            league_service.create_league(
                db,
                LeagueCreate(name="solo", season_id=unified.id, draft_mode=False, sports=["football"]),
                owner,
            )
        assert exc.value.status_code == 400


# ── Phase 4a: window_locator None-guard ────────────────────────────────────

def test_get_league_sport_season_none_sport_does_not_shortcircuit_to_unified():
    with session_scope() as db:
        league, unified, fb, bb, football, basketball = _unified_league(db)
        db.commit()

        # The bug this guards: None == None short-circuiting to the unified season.
        assert get_league_sport_season(db, league_id=league.id, sport_id=None) is None
        # Real sports still resolve through the LeagueSport mapping.
        assert get_league_sport_season(db, league_id=league.id, sport_id=football.id).id == fb.id
        assert get_league_sport_season(db, league_id=league.id, sport_id=basketball.id).id == bb.id


# ── Phase 4b: unified league scores under its unified window ────────────────

def test_incoming_component_window_scores_under_the_unified_window(monkeypatch):
    with session_scope() as db:
        league, unified, fb, bb, football, basketball = _unified_league(db)
        gw_day = TODAY  # inside the overlap
        unified_window = _window(db, unified, number=3, on=gw_day)
        football_window = _window(db, fb, number=3, on=gw_day)
        db.commit()

        seen = _capture_scoring_calls(monkeypatch)
        result = scoring_engine.score_transfer_window_for_league(
            db, league_id=league.id, transfer_window_id=football_window.id
        )

        assert result == {}
        # Team score is written under the UNIFIED window, not the football window.
        assert seen == [unified_window.id]


def test_component_window_with_no_covering_unified_window_is_skipped(monkeypatch):
    """How "compete only within the overlap" is enforced: a component gameweek
    the unified schedule doesn't cover simply has no native window and is skipped
    — no explicit date check needed."""
    with session_scope() as db:
        league, unified, fb, bb, football, basketball = _unified_league(db)
        # A football window on a day the unified season has NO window for.
        football_window = _window(db, fb, number=9, on=TODAY + timedelta(days=3))
        db.commit()

        seen = _capture_scoring_calls(monkeypatch)
        result = scoring_engine.score_transfer_window_for_league(
            db, league_id=league.id, transfer_window_id=football_window.id
        )

        assert result == {"skipped": True, "reason": "no_native_window"}
        assert seen == []


# ── Phase 4c: unified window is inert as a discovery driver ─────────────────

def test_unified_window_is_inert_in_discovery():
    with session_scope() as db:
        league, unified, fb, bb, football, basketball = _unified_league(db)
        unified_window = _window(db, unified, number=3, on=TODAY)
        db.commit()

        result = scoring_engine.score_transfer_window_for_season_leagues(
            db, transfer_window_id=unified_window.id, commit=False
        )
        # A unified window scores NOBODY on its own activation — component-sport
        # passes do the scoring (see test above).
        assert result["leagues_scored"] == 0


# ── Backend: unified seasons surface in the league-creation picker ───────────

def test_get_active_seasons_includes_unified_seasons():
    with session_scope() as db:
        football = Sport(name="football", display_name="Football")
        basketball = Sport(name="basketball", display_name="Basketball")
        db.add_all([football, basketball])
        db.flush()
        fb = _season(db, football, start=TODAY - timedelta(days=30), end=TODAY + timedelta(days=30))
        _season(db, basketball, start=TODAY - timedelta(days=30), end=TODAY + timedelta(days=30))
        unified = _unified_season(db, start=TODAY - timedelta(days=30), end=TODAY + timedelta(days=30),
                                  component_ids=[football.id, basketball.id])
        db.commit()

        ids = {s.id for s in league_service.get_active_seasons(db)}
        # Both the real football season AND the unified season must be offered.
        assert fb.id in ids
        assert unified.id in ids  # inner-join regression guard

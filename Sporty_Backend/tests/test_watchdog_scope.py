"""The stale-match watchdog must only ever touch feeder-simulated matches.

Regression guard for the 2026-08-15 incident: La Liga fixture 1570333 was
polled once, at halftime, then force-finished by finalize_stale_live_matches at
its 0-0 halftime score (real result 3-0). Writing 'finished' also removed it
from _missed_finish_candidates, so the reconcile pass could never repair it.

This needs a REAL SQLite session — tests/test_stale_match_watchdog.py drives the
same function through a _FakeDB whose .filter() is a no-op, so it passes with or
without the source predicate and cannot cover this.
"""

from __future__ import annotations

import os
import sys
import tempfile
import types
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from types import SimpleNamespace

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_temp_dir = tempfile.mkdtemp(prefix="sporty-watchdog-scope-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'watchdog_scope.db'}"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["JWT_SECRET_KEY"] = "x" * 32
os.environ["GOOGLE_CLIENT_ID"] = "test-client"

_backend_root = Path(__file__).resolve().parents[1]
os.chdir(_temp_dir)
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from app.database import Base  # noqa: E402

# Register model modules so SQLAlchemy resolves relationships (same convention
# as app/main.py) before feed_scoring's Match/Sport queries are constructed.
from app.auth.models import User  # noqa: F401,E402
from app.ingestion.models import IngestionPlayer  # noqa: F401,E402
from app.league.models import League, Sport  # noqa: F401,E402
from app.match.models import Match  # noqa: E402
from app.notification.models import Notification  # noqa: F401,E402
from app.player.models import Player, RealTeam  # noqa: F401,E402
from app.player.models_nba import NBAStat  # noqa: F401,E402
from app.scoring.models import DefaultScoringRule  # noqa: F401,E402

import app.services.feed_scoring as fs  # noqa: E402
from app.services.sync.status_normalizer import normalize_match_status  # noqa: E402

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


def _make_live_match(db, sport: Sport, *, external_id: str) -> Match:
    """A match stuck on 'live' and stale enough to trip STALE_LIVE_AFTER."""
    now = datetime.now(timezone.utc)
    match = Match(
        sport_id=sport.id,
        external_api_id=external_id,
        home_team="Alaves",
        away_team="Getafe",
        match_date=now - timedelta(hours=6),
        status="live",
        home_score=0,
        away_score=0,
        competition="La Liga",
        season="2026",
    )
    db.add(match)
    db.flush()
    # updated_at has a server_default, so overwrite it after the insert.
    match.updated_at = now - timedelta(hours=5)
    db.flush()
    return match


def _patch_watchdog_deps(monkeypatch) -> list:
    """Stub the lazily-imported scoring trigger (celery import cycle) and the
    stat booking, exactly as tests/test_stale_match_watchdog.py does."""
    stub = types.ModuleType("app.services.scoring.scoring_trigger")
    stub.enqueue_scoring_for_finished_match = lambda db, **kw: 1
    monkeypatch.setitem(sys.modules, "app.services.scoring.scoring_trigger", stub)

    booked: list = []
    monkeypatch.setattr(
        fs,
        "persist_match_stats",
        lambda db, **kw: booked.append(kw) or {"players": 1, "windows": 1},
    )
    return booked


def test_watchdog_finishes_feeder_but_never_real_api_matches(monkeypatch):
    booked = _patch_watchdog_deps(monkeypatch)

    with session_scope() as db:
        sport = Sport(name="football", display_name="Football")
        db.add(sport)
        db.flush()

        feeder = _make_live_match(db, sport, external_id=f"feeder:{uuid.uuid4()}")
        # The real fixture from the incident.
        real = _make_live_match(db, sport, external_id="1570333")
        db.commit()

        redis = SimpleNamespace(publish=lambda channel, msg: None)
        stats = fs.finalize_stale_live_matches(db, redis)

        db.refresh(feeder)
        db.refresh(real)

        # The feeder sim has no other recovery path — it must still be rescued.
        assert feeder.status == "finished"
        # The real fixture belongs to football_live_sync's reconcile pass. If
        # this flips, the reconcile pass loses it forever and the final score
        # stays frozen at whatever minute the last poll happened to see.
        assert real.status == "live"
        assert real.home_score == 0 and real.away_score == 0

        assert stats == {"stale": 1, "finalized": 1}
        assert len(booked) == 1
        assert booked[0]["live_key"].startswith("feeder:")


def test_watchdog_ignores_real_api_match_even_when_it_is_the_only_stale_row(monkeypatch):
    """No feeder rows at all => the watchdog must make zero API/DB writes."""
    booked = _patch_watchdog_deps(monkeypatch)

    with session_scope() as db:
        sport = Sport(name="football", display_name="Football")
        db.add(sport)
        db.flush()
        real = _make_live_match(db, sport, external_id="1570341")
        db.commit()

        published: list = []
        redis = SimpleNamespace(publish=lambda channel, msg: published.append(channel))
        stats = fs.finalize_stale_live_matches(db, redis)

        db.refresh(real)
        assert real.status == "live"
        assert stats == {"stale": 0, "finalized": 0}
        assert booked == [] and published == []


# ── Shared status normalizer ────────────────────────────────────────────────
# football_live_sync used to carry its own _STATUS_MAP which omitted these,
# defaulting them to "scheduled" — so a match in an extra-time break silently
# reverted from live to scheduled and dropped out of the live window.


def test_in_progress_break_codes_normalize_to_live():
    for code in ("1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"):
        assert normalize_match_status(code) == "live", code


def test_terminal_codes_normalize_to_finished():
    for code in ("FT", "AET", "PEN", "AWD", "WO"):
        assert normalize_match_status(code) == "finished", code


def test_unknown_and_empty_codes_fall_back_to_scheduled():
    for code in ("NS", "ZZZ", "", None):
        assert normalize_match_status(code) == "scheduled", code


# ── Live-window candidate scoping ───────────────────────────────────────────
# sportscore_live_sync reuses _fixtures_in_live_window but addresses matches by
# name slug, not by an API-Football id. It used to inherit the numeric-id
# filter, which hid every fixture still on its football-data.org `fdo:`
# placeholder from the one provider that costs nothing to poll.


def _make_kicked_off_match(db, sport: Sport, *, external_id: str) -> Match:
    """A scheduled fixture that kicked off 30 minutes ago — inside the window."""
    match = Match(
        sport_id=sport.id,
        external_api_id=external_id,
        home_team="Atletico Madrid",
        away_team="Malaga",
        match_date=datetime.now(timezone.utc) - timedelta(minutes=30),
        status="scheduled",
        competition="La Liga",
        season="2026",
    )
    db.add(match)
    db.flush()
    return match


def test_live_window_scoping_by_provider_id():
    from app.services.sync.football_live_sync import _fixtures_in_live_window

    with session_scope() as db:
        sport = Sport(name="football", display_name="Football")
        db.add(sport)
        db.flush()

        _make_kicked_off_match(db, sport, external_id="1570334")
        _make_kicked_off_match(db, sport, external_id="fdo:564638")
        db.commit()

        # API-Football callers key on the fixture id, so they must not see the
        # placeholder — matching it would spend a request on a lookup that
        # cannot resolve.
        api_football = _fixtures_in_live_window(db, sport.id)
        assert [m.external_api_id for m in api_football] == ["1570334"]

        # SportScore needs both.
        sportscore = _fixtures_in_live_window(db, sport.id, numeric_id_only=False)
        assert sorted(m.external_api_id for m in sportscore) == ["1570334", "fdo:564638"]

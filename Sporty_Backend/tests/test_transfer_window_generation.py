"""generate_transfer_windows_for_season — happy path, idempotency, and the
race-safety paths (lock-not-acquired, concurrent-insert IntegrityError).
SQLite throwaway DB, same pattern as test_league_status_service.py.

Redis isn't available in this test environment, so redis_lock is monkeypatched
per-test (same pattern as test_repricing.py::test_trigger_repricing_rejects_when_lock_held)
rather than skipped — the lock's acquired/not-acquired branches are real
control flow in generate_transfer_windows_for_season and need coverage.
"""
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

_temp_dir = tempfile.mkdtemp(prefix="sporty-window-gen-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'windowgen.db'}"
os.environ["JWT_SECRET_KEY"] = "x" * 32
os.environ["GOOGLE_CLIENT_ID"] = "test-client"

_backend_root = Path(__file__).resolve().parents[1]
os.chdir(_temp_dir)
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from app.database import Base  # noqa: E402
from app.auth.models import AuthProvider, User  # noqa: F401,E402
import app.match.models  # noqa: F401,E402
import app.player.models  # noqa: F401,E402
import app.player.models_nba  # noqa: F401,E402
from app.league.models import Season, Sport, TransferWindow  # noqa: E402
from app.services import transfer_window_service  # noqa: E402
from app.services.transfer_window_service import generate_transfer_windows_for_season  # noqa: E402

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
def _lock_acquired(*args, **kwargs):
    yield True


@contextmanager
def _lock_not_acquired(*args, **kwargs):
    yield False


def _season(db, *, weeks: int = 8):
    sport = Sport(name="football", display_name="Football")
    db.add(sport)
    db.flush()

    start = date(2026, 8, 3)  # a Monday
    season = Season(
        sport_id=sport.id, name=f"S-{uuid.uuid4().hex[:6]}",
        start_date=start, end_date=start + timedelta(weeks=weeks),
    )
    db.add(season)
    db.flush()
    return season


def test_happy_path_generates_one_window_per_week(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(transfer_window_service, "redis_lock", _lock_acquired)

    with session_scope() as db:
        season = _season(db, weeks=4)

        windows = generate_transfer_windows_for_season(db, season, transfer_day=1)

        assert len(windows) == 5  # weeks 0..4 inclusive, Monday each time
        assert windows[0].number == 1
        assert windows[0].start_at.weekday() == 0  # Monday
        # Start-anchored deadlines: transfer locks the instant the window opens,
        # lineup one minute after.
        assert windows[0].transfer_deadline_at == windows[0].start_at
        assert windows[0].lineup_deadline_at == windows[0].start_at + timedelta(minutes=1)
        assert season.transfer_day == 1


def test_windows_are_contiguous_seven_day_spans(monkeypatch: pytest.MonkeyPatch):
    """1-day windows left 6-day gaps, and fixtures landing in them scored into
    nothing (the bug scripts/fix_real_season_windows.py repaired for football).
    Every day of the season must belong to exactly one window."""
    monkeypatch.setattr(transfer_window_service, "redis_lock", _lock_acquired)

    with session_scope() as db:
        season = _season(db, weeks=4)

        windows = generate_transfer_windows_for_season(db, season, transfer_day=1)

        for window in windows:
            assert window.end_at - window.start_at == timedelta(days=7, seconds=-1)

        # No gaps and no overlaps: each window opens 1s after the last one closes.
        for earlier, later in zip(windows, windows[1:]):
            assert later.start_at - earlier.end_at == timedelta(seconds=1)


def test_first_window_covers_a_midweek_season_start(monkeypatch: pytest.MonkeyPatch):
    """Anchoring forward to the next transfer_day would leave the opening days
    of a mid-week season uncovered — NBA 2026-27 tips off on a Tuesday."""
    monkeypatch.setattr(transfer_window_service, "redis_lock", _lock_acquired)

    with session_scope() as db:
        sport = Sport(name="basketball", display_name="Basketball")
        db.add(sport)
        db.flush()
        # A Tuesday, mirroring the real NBA 2026-27 tip-off.
        start = date(2026, 10, 20)
        season = Season(
            sport_id=sport.id, name="S-midweek",
            start_date=start, end_date=date(2027, 4, 12),
        )
        db.add(season)
        db.flush()

        windows = generate_transfer_windows_for_season(db, season, transfer_day=1)

        # Backs up to Monday the 19th so opening night is inside window 1.
        assert windows[0].start_at.date() == date(2026, 10, 19)
        assert windows[0].start_at.date() <= start <= windows[0].end_at.date()
        # And the far end still reaches the season's last day.
        assert windows[-1].end_at.date() >= season.end_date


def test_idempotent_second_call_reuses_existing_windows(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(transfer_window_service, "redis_lock", _lock_acquired)

    with session_scope() as db:
        season = _season(db, weeks=4)

        first = generate_transfer_windows_for_season(db, season, transfer_day=1)
        db.flush()
        second = generate_transfer_windows_for_season(db, season, transfer_day=3)  # different day, ignored

        assert [w.id for w in first] == [w.id for w in second]
        assert season.transfer_day == 1  # unchanged by the reuse call

        total = db.query(TransferWindow).filter(TransferWindow.season_id == season.id).count()
        assert total == len(first)


def test_invalid_transfer_day_rejected():
    with session_scope() as db:
        season = _season(db, weeks=4)

        with pytest.raises(HTTPException) as exc_info:
            generate_transfer_windows_for_season(db, season, transfer_day=8)

        assert exc_info.value.status_code == 422


def test_lock_not_acquired_and_no_existing_windows_returns_409(monkeypatch: pytest.MonkeyPatch):
    """Another request is presumably still generating (holds the lock) and
    hasn't committed yet — surface a clean 409, don't proceed unlocked."""
    monkeypatch.setattr(transfer_window_service, "redis_lock", _lock_not_acquired)

    with session_scope() as db:
        season = _season(db, weeks=4)

        with pytest.raises(HTTPException) as exc_info:
            generate_transfer_windows_for_season(db, season, transfer_day=1)

        assert exc_info.value.status_code == 409
        assert db.query(TransferWindow).filter(TransferWindow.season_id == season.id).count() == 0


def test_lock_not_acquired_but_windows_already_committed_returns_them(monkeypatch: pytest.MonkeyPatch):
    """The other request finished (and committed) between us failing to grab
    the lock and re-checking — reuse its result instead of erroring."""
    monkeypatch.setattr(transfer_window_service, "redis_lock", _lock_acquired)

    with session_scope() as db:
        season = _season(db, weeks=4)
        existing = generate_transfer_windows_for_season(db, season, transfer_day=1)
        db.flush()

        monkeypatch.setattr(transfer_window_service, "redis_lock", _lock_not_acquired)
        result = generate_transfer_windows_for_season(db, season, transfer_day=1)

        assert [w.id for w in result] == [w.id for w in existing]


def test_concurrent_insert_integrity_error_surfaces_as_409(monkeypatch: pytest.MonkeyPatch):
    """A second process's insert slips past our lock and commits first — our
    own flush should hit the season/window overlap constraint. Simulated
    here via a monkeypatched flush since the real EXCLUDE constraint is
    Postgres-only (skipped in the SQLite test DB, per conftest.py)."""
    monkeypatch.setattr(transfer_window_service, "redis_lock", _lock_acquired)

    from sqlalchemy.exc import IntegrityError

    with session_scope() as db:
        season = _season(db, weeks=4)

        def _raise_integrity_error():
            raise IntegrityError("insert", {}, Exception("duplicate"))

        monkeypatch.setattr(db, "flush", _raise_integrity_error)

        with pytest.raises(HTTPException) as exc_info:
            generate_transfer_windows_for_season(db, season, transfer_day=1)

        assert exc_info.value.status_code == 409

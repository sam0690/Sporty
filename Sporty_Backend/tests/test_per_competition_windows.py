"""Per-competition transfer windows: the write-path booking rule that a match's
stats land in its OWN competition window PLUS the combined (NULL) schedule, and
never in a sibling competition's overlapping window.

SQLite throwaway DB, same bootstrap pattern as test_transfer_window_generation.py.
"""
from __future__ import annotations

import os
import sys
import tempfile
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

_temp_dir = tempfile.mkdtemp(prefix="sporty-percomp-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'percomp.db'}"
os.environ["JWT_SECRET_KEY"] = "x" * 32
os.environ["GOOGLE_CLIENT_ID"] = "test-client"

_backend_root = Path(__file__).resolve().parents[1]
os.chdir(_temp_dir)
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from app.database import Base  # noqa: E402
from app.auth.models import AuthProvider, User  # noqa: F401,E402
import app.match.models  # noqa: F401,E402
import app.player.models  # noqa: F401,E402
import app.player.models_nba  # noqa: F401,E402
import app.notification.models  # noqa: F401,E402
from app.league.models import Season, Sport, TransferWindow  # noqa: E402
from app.services.scoring.window_locator import find_transfer_window_ids_for_datetime  # noqa: E402

ENGINE = create_engine(os.environ["DATABASE_URL"])
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=ENGINE)

T0 = datetime(2026, 8, 22, 14, 0, tzinfo=timezone.utc)


def _win(season_id, comp, number):
    return TransferWindow(
        season_id=season_id, competition=comp, number=number,
        start_at=T0 - timedelta(hours=1), end_at=T0 + timedelta(hours=1),
        transfer_deadline_at=T0 - timedelta(hours=1),
        lineup_deadline_at=T0 - timedelta(hours=1) + timedelta(minutes=1),
    )


def _fresh_db():
    Base.metadata.drop_all(bind=ENGINE)
    Base.metadata.create_all(bind=ENGINE)
    db = SessionLocal()
    football = Sport(id=uuid.uuid4(), name="football", display_name="Football")
    season = Season(
        id=uuid.uuid4(), sport_id=football.id, name="S", start_date=T0.date(),
        end_date=(T0 + timedelta(days=280)).date(),
    )
    db.add_all([football, season])
    # Three schedules overlapping the same instant: EPL, LALIGA, and combined.
    epl = _win(season.id, "EPL", 1)
    laliga = _win(season.id, "LALIGA", 1)
    combined = _win(season.id, None, 1)
    db.add_all([epl, laliga, combined])
    db.flush()
    return db, football.id, {"EPL": epl.id, "LALIGA": laliga.id, "COMBINED": combined.id}


def test_match_books_own_competition_plus_combined_only():
    db, sport_id, ids = _fresh_db()
    got = set(find_transfer_window_ids_for_datetime(
        db, match_date=T0, sport_id=sport_id, competition_tag="EPL",
    ))
    assert got == {ids["EPL"], ids["COMBINED"]}, "EPL match must book EPL + combined, not LALIGA"
    assert ids["LALIGA"] not in got
    db.close()


def test_no_tag_matches_every_covering_window():
    # Non-football sports pass competition_tag=None → no competition filter.
    db, sport_id, ids = _fresh_db()
    got = set(find_transfer_window_ids_for_datetime(
        db, match_date=T0, sport_id=sport_id, competition_tag=None,
    ))
    assert got == set(ids.values())
    db.close()


if __name__ == "__main__":
    test_match_books_own_competition_plus_combined_only()
    test_no_tag_matches_every_covering_window()
    print("per-competition window booking: OK")

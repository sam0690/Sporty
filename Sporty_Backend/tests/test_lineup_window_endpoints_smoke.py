"""End-to-end smoke test for the league window/lineup endpoints THROUGH THE
FACADE (app.league.services) with response-model validation.

Guards the class of bug that produced three production 500s in a row (a
NameError from a missing import, a function missing from the facade re-export,
and a non-nullable response field that is legitimately None pre-season) — none
of which the unit tests caught because nothing called these endpoints end to
end. Exercises the PRE_SEASON state specifically (no live window), which is
where the null transfer_window_id / no-window paths live.

SQLite throwaway DB, same bootstrap as test_transfer_window_generation.py.
"""
from __future__ import annotations

import os
import sys
import tempfile
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

_temp_dir = tempfile.mkdtemp(prefix="sporty-lineup-smoke-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'x.db'}"
os.environ["JWT_SECRET_KEY"] = "x" * 32
os.environ["GOOGLE_CLIENT_ID"] = "test-client"

_backend_root = Path(__file__).resolve().parents[1]
os.chdir(_temp_dir)
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from app.database import Base  # noqa: E402
from app.auth.models import AuthProvider, User  # noqa: E402
import app.match.models  # noqa: F401,E402
import app.player.models  # noqa: F401,E402
import app.player.models_nba  # noqa: F401,E402
import app.notification.models  # noqa: F401,E402
from app.league.models import (  # noqa: E402
    FantasyTeam, League, LeagueMembership, LeagueSport, Season, Sport, TransferWindow,
)
from app.league import services as facade  # the router's import  # noqa: E402
from app.league.schemas import (  # noqa: E402
    LeagueSeasonStateResponse, LineupResponse, TransferWindowResponse,
)

ENGINE = create_engine(os.environ["DATABASE_URL"])
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=ENGINE)


def _preseason_league(db):
    """A football league whose single (combined) window opens in the future —
    so: PRE_SEASON, no live window, editable = GW1."""
    now = datetime.now(timezone.utc)
    opens = now + timedelta(days=10)
    football = Sport(id=uuid.uuid4(), name="football", display_name="Football")
    season = Season(
        id=uuid.uuid4(), sport_id=football.id, name="S",
        start_date=opens.date(), end_date=(now + timedelta(days=280)).date(),
    )
    db.add_all([football, season])
    db.add(TransferWindow(
        season_id=season.id, competition=None, number=1,
        start_at=opens, end_at=opens + timedelta(days=7),
        transfer_deadline_at=opens, lineup_deadline_at=opens + timedelta(minutes=1),
    ))
    owner = User(id=uuid.uuid4(), username="owner", email="o@x.com",
                 auth_provider=AuthProvider.LOCAL, password_hash="x")
    db.add(owner)
    db.flush()
    lg_id = uuid.uuid4()
    db.add(League(
        id=lg_id, name="smoke", invite_code="SMOKE1", owner_id=owner.id,
        season_id=season.id, season_group_id=lg_id,
    ))
    db.add(LeagueSport(league_id=lg_id, sport_id=football.id, season_id=season.id,
                       competition_filter=None))
    db.add(LeagueMembership(league_id=lg_id, user_id=owner.id))
    db.add(FantasyTeam(
        league_id=lg_id, user_id=owner.id, name="team",
        current_budget=100, starting_budget=100, starting_squad_size=15,
    ))
    db.flush()
    return lg_id, owner.id


def _db():
    Base.metadata.drop_all(bind=ENGINE)
    Base.metadata.create_all(bind=ENGINE)
    return SessionLocal()


def test_preseason_window_endpoints_validate_through_facade():
    db = _db()
    lg_id, owner_id = _preseason_league(db)

    # live-lineup: no window is live pre-season → transfer_window_id is None,
    # which the response model MUST accept (the exact bug that 500'd in prod).
    # Goes through the facade + LineupResponse.model_validate, so it also guards
    # the facade re-export and any NameError in the call path.
    live = LineupResponse.model_validate(facade.get_live_lineup(db, lg_id, owner_id))
    assert live.transfer_window_id is None
    assert live.starting_lineup == []

    # editable-window and season-state can't be *called* under SQLite (their
    # _serialize_window / phase compares tz-aware now to a datetime SQLite hands
    # back naive — Postgres stores tz-aware, verified in prod). Guard the
    # re-export gap that 500'd them statically instead; the response models are
    # imported above so a rename breaks this test at import.
    assert hasattr(facade, "get_editable_transfer_window")
    assert hasattr(facade, "get_league_season_state")
    assert TransferWindowResponse is not None and LeagueSeasonStateResponse is not None
    db.close()


if __name__ == "__main__":
    test_preseason_window_endpoints_validate_through_facade()
    print("lineup/window endpoint smoke: OK")

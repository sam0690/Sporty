"""Unified fixtures endpoint (GET /fixtures) — merges fantasy `matches` rows
with display-only competition snapshot matches (Champions League) for a day.

Verifies the merge, the source discriminator (fantasy vs display tag), status
normalization, and that a sport filter excludes the football-only display
competitions. SQLite throwaway DB, same bootstrap as the other slice tests.
"""
from __future__ import annotations

import os
import sys
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path

_temp_dir = tempfile.mkdtemp(prefix="sporty-fixtures-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'fx.db'}"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["JWT_SECRET_KEY"] = "x" * 32
os.environ["GOOGLE_CLIENT_ID"] = "test-client"

_backend_root = Path(__file__).resolve().parents[1]
os.chdir(_temp_dir)
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from app.database import Base  # noqa: E402
import app.auth.models  # noqa: F401,E402
import app.player.models  # noqa: F401,E402
import app.player.models_nba  # noqa: F401,E402
from app.models.db.competition_snapshot import CompetitionSnapshot  # noqa: E402
from app.match.models import Match  # noqa: E402
from app.match.router import build_fixtures  # noqa: E402
from app.league.models import Sport  # noqa: E402

ENGINE = create_engine(os.environ["DATABASE_URL"])
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=ENGINE)

DAY = "2026-01-28"


def _seed(db):
    football = Sport(name="football", display_name="Football")
    db.add(football)
    db.flush()
    # A fantasy match on DAY.
    db.add(Match(
        sport_id=football.id, external_api_id="1234", home_team="Arsenal",
        away_team="Chelsea", match_date=datetime(2026, 1, 28, 20, 0, tzinfo=timezone.utc),
        status="finished", competition="Premier League", season="2026",
        home_score=2, away_score=1,
    ))
    # A display-only CL snapshot with one match on DAY + one on another day.
    db.add(CompetitionSnapshot(
        competition="UCL", season=2025, kind="matches",
        payload={"matches": [
            {"id": 55501, "utcDate": "2026-01-28T20:00:00Z", "status": "FINISHED",
             "stage": "LEAGUE_STAGE",
             "homeTeam": {"id": 1, "name": "Barcelona", "crest": "u://barca.png"},
             "awayTeam": {"id": 2, "name": "PSG", "crest": "u://psg.png"},
             "score": {"fullTime": {"home": 4, "away": 1}}},
            {"id": 55502, "utcDate": "2026-02-11T20:00:00Z", "status": "TIMED",
             "stage": "LAST_16",
             "homeTeam": {"id": 3, "name": "Bayern"}, "awayTeam": {"id": 4, "name": "Inter"},
             "score": {"fullTime": {"home": None, "away": None}}},
        ]},
    ))
    db.commit()


def _fresh_db():
    Base.metadata.drop_all(bind=ENGINE)
    Base.metadata.create_all(bind=ENGINE)
    db = SessionLocal()
    _seed(db)
    return db


def test_merges_fantasy_and_display_matches():
    db = _fresh_db()
    try:
        fx = build_fixtures(db, DAY, None)
        by_source = {(f.source, f.home_team): f for f in fx}
        assert len(fx) == 2  # only the two matches on DAY (the CL Feb match excluded)

        fantasy = by_source[("fantasy", "Arsenal")]
        assert fantasy.id and fantasy.source == "fantasy" and fantasy.competition == "Premier League"

        cl = by_source[("UCL", "Barcelona")]
        assert cl.source == "UCL"
        assert cl.id == "55501"                    # football-data.org id, for the CL detail route
        assert cl.status == "finished"             # normalized from FINISHED
        assert cl.stage == "LEAGUE_STAGE"
        assert cl.home_score == 4 and cl.away_score == 1
        assert cl.home_team_logo_url == "u://barca.png"  # crest from the snapshot
    finally:
        db.close()


def test_sport_filter_excludes_display_competitions():
    db = _fresh_db()
    try:
        fx = build_fixtures(db, DAY, "basketball")
        assert fx == []  # no basketball fantasy matches, and CL is football-only
        fx_fb = build_fixtures(db, DAY, "football")
        assert {f.source for f in fx_fb} == {"fantasy", "UCL"}
    finally:
        db.close()

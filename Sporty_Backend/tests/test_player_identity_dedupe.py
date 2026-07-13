"""Importer identity fallback — the fix for the double-seeded Liverpool roster.

The two EPL CSVs spell the club differently ("Liverpool" vs "Liverpool FC"),
so external_api_id-only matching forked the whole roster into a second slug
namespace. These tests pin the two-layer fix:
  1. canonical_team_name folds known team-name aliases before slugs are built.
  2. DatasetImporter._upsert_player falls back to (sport, real_team, name)
     matching when the external_api_id misses, updating in place instead of
     inserting a duplicate — and keeps the original external_api_id.
"""

from __future__ import annotations

import os
import tempfile
from decimal import Decimal
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_temp_dir = tempfile.mkdtemp(prefix="sporty-player-dedupe-tests-")
os.environ.setdefault("DATABASE_URL", f"sqlite+pysqlite:///{Path(_temp_dir) / 'dedupe.db'}")
os.environ.setdefault("JWT_SECRET_KEY", "x" * 32)
os.environ.setdefault("GOOGLE_CLIENT_ID", "test-client")

from app.database import Base
import app.auth.models  # noqa: F401
import app.league.models  # noqa: F401
import app.match.models  # noqa: F401
import app.player.models_nba  # noqa: F401
from app.core.team_names import canonical_team_name
from app.ingestion.dataset_importer import DatasetImporter
from app.league.models import Sport
from app.player.models import Player

_engine = create_engine(f"sqlite+pysqlite:///{Path(_temp_dir) / 'dedupe.db'}")
Base.metadata.create_all(_engine)
_Session = sessionmaker(bind=_engine)


def test_canonical_team_name_folds_known_aliases():
    assert canonical_team_name("Liverpool FC") == "Liverpool"
    assert canonical_team_name("Liverpool") == "Liverpool"
    assert canonical_team_name(" Wolves ") == "Wolverhampton"
    # Unknown names pass through — non-football sports are unaffected.
    assert canonical_team_name("Boston Celtics") == "Boston Celtics"


def test_upsert_player_falls_back_to_name_and_team_identity():
    db = _Session()
    try:
        sport = Sport(name="football", display_name="Football")
        db.add(sport)
        db.flush()

        importer = DatasetImporter(db, dataset_roots=[])
        team = importer._ensure_real_team(
            sport=sport, external_id="football:liverpool", name="Liverpool"
        )

        first = importer._upsert_player(
            sport=sport,
            external_id="football:mohamed_salah:liverpool:mid",
            name="Mohamed Salah",
            position="MID",
            real_team="Liverpool",
            real_team_ref=team,
            cost=Decimal("12.5"),
        )
        db.flush()

        # Same player re-imported under a different slug namespace (the
        # "Liverpool FC" CSV run) must update the existing row, not fork one.
        second = importer._upsert_player(
            sport=sport,
            external_id="football:mohamed_salah:liverpool_fc:mid",
            name="Mohamed Salah",
            position="MID",
            real_team="Liverpool",
            real_team_ref=team,
            cost=Decimal("13.0"),
        )
        db.flush()

        assert second.id == first.id
        # Identity is stable: the original external_api_id survives.
        assert second.external_api_id == "football:mohamed_salah:liverpool:mid"
        assert second.cost == Decimal("13.0")
        assert db.query(Player).filter(Player.sport_id == sport.id).count() == 1

        # A genuinely different player on the same team still inserts.
        importer._upsert_player(
            sport=sport,
            external_id="football:cody_gakpo:liverpool:mid",
            name="Cody Gakpo",
            position="MID",
            real_team="Liverpool",
            real_team_ref=team,
            cost=Decimal("8.0"),
        )
        db.flush()
        assert db.query(Player).filter(Player.sport_id == sport.id).count() == 2
    finally:
        db.rollback()
        db.close()

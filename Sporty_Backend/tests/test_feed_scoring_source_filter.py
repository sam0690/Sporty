"""SportScore rows must never reach the gameweek stat aggregation.

This is the one path where a display-only provider could change fantasy points:
_finish_match falls back to counting live_events when the full-time stat sheet
can't be fetched, and _apply_football_counts ASSIGNS those counts. Both
providers report the same real-world goals under their own event ids, so
without the source filter one goal would be booked as two.
"""

import os
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

_temp_dir = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'src_filter.db'}"

# Relationship targets must be imported before any mapper is configured —
# app/main.py does the same up front, for the same reason.
from app.auth.models import User  # noqa: E402,F401
from app.player.models import Player  # noqa: E402,F401
from app.models.db.live_event import LiveEvent  # noqa: E402
from app.services.feed_scoring import _aggregate_match_events  # noqa: E402

ENGINE = create_engine(os.environ["DATABASE_URL"])
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=ENGINE)
LiveEvent.__table__.create(bind=ENGINE, checkfirst=True)

PLAYER_ID = str(uuid.uuid4())
LIVE_KEY = "1570333"


def _event(event_id: str, source: str | None) -> LiveEvent:
    meta = {"minute": 43}
    if source:
        meta["source"] = source
    return LiveEvent(
        match_id=LIVE_KEY, event_id=event_id, sport="football", event_type="goal",
        player_id=PLAYER_ID, team_id="", value=0.0, meta=meta,
        ts=datetime.now(timezone.utc),
    )


def test_the_same_goal_from_both_providers_is_counted_once():
    db = SessionLocal()
    try:
        db.add(_event("1570333:43:Goal:12345:Normal Goal", "api-football"))
        db.add(_event("ss:1570333:43:goal:pablo maia", "sportscore"))
        db.commit()

        counts = _aggregate_match_events(db, LIVE_KEY)
        assert counts[uuid.UUID(PLAYER_ID)]["goal"] == 1
    finally:
        db.query(LiveEvent).delete()
        db.commit()
        db.close()


def test_rows_without_a_source_are_still_counted():
    """Feeder pushes and basketball rows carry no `source` key. IS DISTINCT FROM
    keeps them — this filter must not quietly drop every non-football event."""
    db = SessionLocal()
    try:
        db.add(_event("feeder:evt:1", None))
        db.commit()

        counts = _aggregate_match_events(db, LIVE_KEY)
        assert counts[uuid.UUID(PLAYER_ID)]["goal"] == 1
    finally:
        db.query(LiveEvent).delete()
        db.commit()
        db.close()

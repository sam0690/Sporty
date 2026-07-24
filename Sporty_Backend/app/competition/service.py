"""Read-through service for the public competition pages.

Serves standings / scorers / matches per (competition tag, season) from the
`competition_snapshots` cache, fetching from football-data.org on a miss.
The current season is refreshed by the daily sync (or on-read if stale);
historical seasons are immutable, so once cached they never re-fetch.

Kept entirely separate from the fantasy `matches` table — this is display
data for real competitions, not fantasy scoring input.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.external_apis.football_data_org import (
    FDO_MIN_SEASON,
    get_competition_matches,
    get_competition_scorers,
    get_competition_standings,
)
from app.models.db.competition_snapshot import CompetitionSnapshot
from app.services.sync.football_competitions import FOOTBALL_COMPETITIONS

logger = logging.getLogger(__name__)

# Current-season snapshots older than this are re-fetched on read (the daily
# sync normally keeps them fresh; this covers gaps between runs).
_CURRENT_SEASON_TTL = timedelta(hours=6)

# tag -> fdo competition code
_TAG_TO_FDO: dict[str, str] = {c.tag: c.fdo_code for c in FOOTBALL_COMPETITIONS.values()}

_KIND_FETCHERS = {
    "standings": get_competition_standings,
    "scorers": get_competition_scorers,
    "matches": get_competition_matches,
}


def _aware(dt: datetime) -> datetime:
    """Treat a naive timestamp as UTC — Postgres returns tz-aware, SQLite
    (tests) returns naive; the freshness comparison must work on both."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def current_season() -> int:
    now = datetime.now(timezone.utc)
    return now.year if now.month >= 7 else now.year - 1


def available_seasons() -> list[int]:
    """Newest first, down to the free-tier horizon."""
    return list(range(current_season(), FDO_MIN_SEASON - 1, -1))


def list_competitions() -> list[dict]:
    return [
        {"tag": c.tag, "name": c.name, "fdo_code": c.fdo_code}
        for c in FOOTBALL_COMPETITIONS.values()
    ]


def _validate(tag: str, season: int) -> str:
    if tag not in _TAG_TO_FDO:
        raise ValueError(f"Unknown competition '{tag}'")
    if season not in available_seasons():
        raise ValueError(
            f"Season {season} out of range (available: {available_seasons()[-1]}–{available_seasons()[0]})"
        )
    return _TAG_TO_FDO[tag]


async def get_snapshot(db: Session, tag: str, kind: str, season: int | None = None) -> dict:
    """Return the cached payload for (tag, season, kind), fetching+storing on a
    miss or when the current-season copy is stale. Owns its transaction."""
    season = season or current_season()
    fdo_code = _validate(tag, season)
    if kind not in _KIND_FETCHERS:
        raise ValueError(f"Unknown kind '{kind}'")

    row = (
        db.query(CompetitionSnapshot)
        .filter(
            CompetitionSnapshot.competition == tag,
            CompetitionSnapshot.season == season,
            CompetitionSnapshot.kind == kind,
        )
        .first()
    )

    is_current = season == current_season()
    fresh_enough = row is not None and (
        not is_current or _aware(row.updated_at) >= datetime.now(timezone.utc) - _CURRENT_SEASON_TTL
    )
    if fresh_enough:
        return row.payload

    try:
        payload = await _KIND_FETCHERS[kind](fdo_code, season)
    except Exception:
        logger.exception("Competition fetch failed: %s %s %s", tag, season, kind)
        if row is not None:
            return row.payload  # serve stale rather than error
        raise

    _upsert(db, tag, season, kind, payload)
    return payload


def _upsert(db: Session, tag: str, season: int, kind: str, payload: dict) -> None:
    row = (
        db.query(CompetitionSnapshot)
        .filter(
            CompetitionSnapshot.competition == tag,
            CompetitionSnapshot.season == season,
            CompetitionSnapshot.kind == kind,
        )
        .first()
    )
    if row is None:
        db.add(CompetitionSnapshot(competition=tag, season=season, kind=kind, payload=payload))
    else:
        row.payload = payload
    db.commit()


async def refresh_current_season(db: Session) -> dict:
    """Daily sync entry point: refresh standings + scorers + matches for every
    tracked competition's current season. ~9 football-data.org calls."""
    season = current_season()
    refreshed = 0
    for tag, fdo_code in _TAG_TO_FDO.items():
        for kind, fetch in _KIND_FETCHERS.items():
            try:
                payload = await fetch(fdo_code, season)
            except Exception:
                logger.exception("Competition refresh failed: %s %s %s", tag, season, kind)
                continue
            _upsert(db, tag, season, kind, payload)
            refreshed += 1
    return {"season": season, "refreshed": refreshed}

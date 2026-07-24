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


def resolved_season(payload: dict) -> int | None:
    """The season year football-data.org reports in a response. Lets the
    current-view fetch (no season param) record which season it actually got —
    needed because CL's calendar lags the domestic leagues. Standings/scorers
    carry a `season` object; the matches endpoint only carries `filters.season`."""
    start = ((payload.get("season") or {}).get("startDate") or "")[:4]
    if start.isdigit():
        return int(start)
    fseason = str((payload.get("filters") or {}).get("season") or "")
    return int(fseason) if fseason.isdigit() else None


async def get_snapshot(db: Session, tag: str, kind: str, season: int | None = None) -> dict:
    """Cached payload for (tag, season, kind). Owns its transaction.

    season=None → the competition's own CURRENT season: fetched with no season
    param (football-data.org resolves each competition's in-progress season —
    the domestic leagues and the Champions League differ), stored under the
    resolved year, kept fresh by TTL. season=N → that historical season,
    immutable once cached.
    """
    tag = tag.upper()
    if tag not in _TAG_TO_FDO:
        raise ValueError(f"Unknown competition '{tag}'")
    if kind not in _KIND_FETCHERS:
        raise ValueError(f"Unknown kind '{kind}'")
    fdo_code = _TAG_TO_FDO[tag]

    if season is None:
        # Current view — the latest stored season for this competition, kept
        # fresh; fetch resolves the competition's own current season.
        row = (
            db.query(CompetitionSnapshot)
            .filter(CompetitionSnapshot.competition == tag, CompetitionSnapshot.kind == kind)
            .order_by(CompetitionSnapshot.season.desc())
            .first()
        )
        if row is not None and _aware(row.updated_at) >= datetime.now(timezone.utc) - _CURRENT_SEASON_TTL:
            return row.payload
        try:
            payload = await _KIND_FETCHERS[kind](fdo_code, None)
        except Exception:
            logger.exception("Competition current fetch failed: %s %s", tag, kind)
            if row is not None:
                return row.payload  # serve stale rather than error
            raise
        _upsert(db, tag, resolved_season(payload) or current_season(), kind, payload)
        return payload

    # Historical — explicit season, immutable once cached.
    if season not in available_seasons():
        raise ValueError(
            f"Season {season} out of range (available: {available_seasons()[-1]}–{available_seasons()[0]})"
        )
    row = (
        db.query(CompetitionSnapshot)
        .filter(
            CompetitionSnapshot.competition == tag,
            CompetitionSnapshot.season == season,
            CompetitionSnapshot.kind == kind,
        )
        .first()
    )
    if row is not None:
        return row.payload
    payload = await _KIND_FETCHERS[kind](fdo_code, season)
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
    tracked competition's CURRENT season (no season param — each competition
    resolves its own, since CL's calendar lags the domestic leagues). ~12
    football-data.org calls (4 competitions × 3 kinds)."""
    refreshed = 0
    for tag, fdo_code in _TAG_TO_FDO.items():
        for kind, fetch in _KIND_FETCHERS.items():
            try:
                payload = await fetch(fdo_code, None)
            except Exception:
                logger.exception("Competition refresh failed: %s %s", tag, kind)
                continue
            _upsert(db, tag, resolved_season(payload) or current_season(), kind, payload)
            refreshed += 1
    return {"refreshed": refreshed}

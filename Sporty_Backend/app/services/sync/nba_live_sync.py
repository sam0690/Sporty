from __future__ import annotations

from sqlalchemy.orm import Session


async def sync_nba_live_matches(db: Session) -> str:
    _ = db
    return "ok: nba live sync not implemented yet"

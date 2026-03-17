from __future__ import annotations

from sqlalchemy.orm import Session


async def sync_cricket_live_matches(db: Session) -> str:
    _ = db
    return "ok: cricket live sync not implemented yet"

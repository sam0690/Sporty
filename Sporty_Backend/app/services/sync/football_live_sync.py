from __future__ import annotations

from sqlalchemy.orm import Session


async def sync_football_live_matches(db: Session) -> str:
    """Poll live football fixtures and update the matches table.

    Stub for now so Celery beat/worker can schedule/import safely.
    Step 6.9/Step 7 will implement real API polling + upserts.
    """

    _ = db
    return "ok: football live sync not implemented yet"

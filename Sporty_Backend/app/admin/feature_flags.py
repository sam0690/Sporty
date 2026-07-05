"""Runtime feature-flag resolution: SystemConfig row (if present) wins,
otherwise fall back to the static settings.<KEY> value. Mirrors the
CSRFMiddleware's fail-open posture (app/middleware/csrf.py) — a DB hiccup
must not take down a code path that already worked fine on env config alone.
"""

from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.admin.models import SystemConfig
from app.core.config import settings

logger = logging.getLogger(__name__)


def get_effective_flag(db: Session, key: str, *, default: bool | None = None) -> bool:
    """Resolve a boolean flag: SystemConfig row > settings.<KEY> > default."""
    fallback = default if default is not None else bool(getattr(settings, key.upper(), False))

    try:
        row = db.query(SystemConfig).filter(SystemConfig.key == key).first()
    except Exception:
        logger.exception("Failed to read SystemConfig for key=%s; falling back to settings", key)
        return fallback

    if row is None:
        return fallback

    value = row.value
    if isinstance(value, dict):
        value = value.get("enabled", fallback)
    return bool(value)

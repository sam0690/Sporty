import json
import logging
from typing import Any

from redis import Redis

logger = logging.getLogger(__name__)

SESSION_TTL_SECONDS = 3600


def _session_key(user_id: str) -> str:
    return f"session:{user_id}"


def get_session(redis: Redis, user_id: str) -> dict[str, Any] | None:
    """Load transfer session JSON from Redis."""
    try:
        raw = redis.get(_session_key(user_id))
        if not raw:
            return None
        value = json.loads(raw)
        if not isinstance(value, dict):
            logger.warning("Invalid session payload type for user=%s", user_id)
            return None
        return value
    except Exception:
        logger.exception("Failed to load transfer session for user=%s", user_id)
        return None


def save_session(redis: Redis, user_id: str, session: dict[str, Any]) -> None:
    """Persist transfer session and reset TTL to one hour."""
    try:
        redis.setex(_session_key(user_id), SESSION_TTL_SECONDS, json.dumps(session))
    except Exception:
        logger.exception("Failed to save transfer session for user=%s", user_id)


def clear_session(redis: Redis, user_id: str) -> None:
    """Delete transfer session from Redis."""
    try:
        redis.delete(_session_key(user_id))
    except Exception:
        logger.exception("Failed to clear transfer session for user=%s", user_id)

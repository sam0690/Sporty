"""Redis-backed distributed lock helper.

Purpose:
- Prevent duplicate Celery jobs (e.g., beat firing while a prior run is still running)
- Ensure only one worker runs a given periodic task at a time

This uses Redis SET NX with an owner token and releases via a Lua script
so one task cannot accidentally release another task's lock.
"""

from __future__ import annotations

import time
import uuid
from contextlib import contextmanager
from typing import Iterator, Optional

from redis import Redis

from app.core.redis import get_redis


_RELEASE_LUA = """
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end
"""


def _acquire_lock(
    redis: Redis,
    key: str,
    ttl_seconds: int,
    wait_seconds: float,
    poll_seconds: float,
) -> Optional[str]:
    token = str(uuid.uuid4())
    deadline = time.time() + max(wait_seconds, 0.0)

    while True:
        acquired = redis.set(name=key, value=token, nx=True, ex=ttl_seconds)
        if acquired:
            return token

        if time.time() >= deadline:
            return None

        time.sleep(max(poll_seconds, 0.05))


def _release_lock(redis: Redis, key: str, token: str) -> bool:
    try:
        released = redis.eval(_RELEASE_LUA, 1, key, token)
        return bool(released)
    except Exception:
        return False


@contextmanager
def redis_lock(
    key: str,
    *,
    ttl_seconds: int = 60,
    wait_seconds: float = 0.0,
    poll_seconds: float = 0.2,
    redis: Optional[Redis] = None,
) -> Iterator[bool]:
    """Acquire a Redis lock.

    Args:
        key: Redis key for the lock (e.g., "lock:sync:football:players")
        ttl_seconds: Auto-expire for safety.
        wait_seconds: If > 0, wait up to this many seconds to acquire the lock.
        poll_seconds: Sleep between retries while waiting.
        redis: Optional Redis client. Defaults to app.core.redis.get_redis().

    Yields:
        bool: True if lock acquired, else False.
    """

    redis_client = redis or get_redis()
    token = _acquire_lock(
        redis_client,
        key=key,
        ttl_seconds=max(int(ttl_seconds), 1),
        wait_seconds=wait_seconds,
        poll_seconds=poll_seconds,
    )

    acquired = token is not None
    try:
        yield acquired
    finally:
        if acquired and token is not None:
            _release_lock(redis_client, key, token)

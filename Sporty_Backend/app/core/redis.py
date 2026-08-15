"""
Redis connection and utilities.

Provides a singleton Redis client and helper functions for caching.
"""

from typing import Optional
import json
import logging

from redis import Redis
import redis.asyncio as aioredis
from redis.connection import ConnectionPool

from app.core.config import settings
from app.core.metrics import cache_ops_total

logger = logging.getLogger(__name__)

# Global Redis client instance
_redis_client: Optional[Redis] = None
_async_redis_client: Optional[aioredis.Redis] = None

# Short-TTL cache for the global (all live matches) part of the dashboard
# favourites ticker — the live-sync busts this on ingest; the endpoint filters
# it per-user. Shared by app/match/router.py and the football live sync.
LIVE_FAVOURITES_CACHE_KEY = "live-for-favourites:global"


async def create_redis_pool() -> aioredis.Redis:
    """Create or return an async Redis client for realtime services."""
    global _async_redis_client

    if _async_redis_client is None:
        _async_redis_client = aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_keepalive=True,
            health_check_interval=30,
        )
        await _async_redis_client.ping()
        logger.info("✅ Async Redis connection established")

    return _async_redis_client


async def get_async_redis() -> aioredis.Redis:
    """Return the async Redis client, creating it if needed."""
    return await create_redis_pool()


async def close_async_redis() -> None:
    """Close async Redis connection used by realtime components."""
    global _async_redis_client
    if _async_redis_client is not None:
        await _async_redis_client.close()
        _async_redis_client = None
        logger.info("✅ Async Redis connection closed")


def get_redis() -> Redis:
    """Get or create the Redis client (singleton)."""
    global _redis_client
    
    if _redis_client is None:
        try:
            _redis_client = Redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,  # Automatically decode bytes to str
                socket_connect_timeout=5,
                socket_keepalive=True,
                health_check_interval=30,
            )
            # Test connection
            _redis_client.ping()
            logger.info("✅ Redis connection established")
        except Exception as e:
            logger.error(f"❌ Failed to connect to Redis: {e}")
            raise
    
    return _redis_client


def close_redis() -> None:
    """Close the Redis connection."""
    global _redis_client
    if _redis_client is not None:
        try:
            _redis_client.close()
            logger.info("✅ Redis connection closed")
        except Exception as e:
            logger.error(f"❌ Error closing Redis connection: {e}")
        finally:
            _redis_client = None


def cache_get(key: str) -> Optional[dict]:
    """
    Get a cached value from Redis.
    
    Args:
        key: Cache key
        
    Returns:
        Parsed JSON object or None if not found
    """
    namespace = key.split(":", 1)[0]
    try:
        redis = get_redis()
        value = redis.get(key)
        if value:
            cache_ops_total.labels(cache=namespace, result="hit").inc()
            return json.loads(value)
    except Exception as e:
        logger.warning(f"⚠️  Cache get failed for key '{key}': {e}")

    cache_ops_total.labels(cache=namespace, result="miss").inc()
    return None


def cache_set(key: str, value: dict, ttl_seconds: int = 300) -> bool:
    """
    Set a cached value in Redis.
    
    Args:
        key: Cache key
        value: Data to cache (will be JSON-encoded)
        ttl_seconds: Time-to-live in seconds (default: 5 minutes)
        
    Returns:
        True if successful, False otherwise
    """
    try:
        redis = get_redis()
        redis.setex(key, ttl_seconds, json.dumps(value))
        return True
    except Exception as e:
        logger.warning(f"⚠️  Cache set failed for key '{key}': {e}")
        return False


def cache_delete(key: str) -> bool:
    """
    Delete a cached value from Redis.
    
    Args:
        key: Cache key
        
    Returns:
        True if deleted, False if not found or error
    """
    try:
        redis = get_redis()
        result = redis.delete(key)
        return result > 0
    except Exception as e:
        logger.warning(f"⚠️  Cache delete failed for key '{key}': {e}")
        return False


def cache_pattern_delete(pattern: str) -> int:
    """
    Delete all keys matching a pattern.
    
    Args:
        pattern: Redis key pattern (e.g., "football:*")
        
    Returns:
        Number of keys deleted
    """
    try:
        redis = get_redis()
        # SCAN, not KEYS: KEYS blocks the entire Redis server for the duration
        # of the scan. Deletes are batched so a large match set is a handful of
        # round-trips rather than one per key.
        deleted = 0
        batch: list[str] = []
        for key in redis.scan_iter(match=pattern, count=500):
            batch.append(key)
            if len(batch) >= 500:
                deleted += redis.delete(*batch)
                batch.clear()
        if batch:
            deleted += redis.delete(*batch)
        return deleted
    except Exception as e:
        logger.warning(f"⚠️  Cache pattern delete failed for pattern '{pattern}': {e}")
        return 0

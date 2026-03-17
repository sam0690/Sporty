"""
Redis connection and utilities.

Provides a singleton Redis client and helper functions for caching.
"""

from typing import Optional
import json
import logging

from redis import Redis
from redis.connection import ConnectionPool

from app.core.config import settings

logger = logging.getLogger(__name__)

# Global Redis client instance
_redis_client: Optional[Redis] = None


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
    try:
        redis = get_redis()
        value = redis.get(key)
        if value:
            return json.loads(value)
    except Exception as e:
        logger.warning(f"⚠️  Cache get failed for key '{key}': {e}")
    
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
        keys = redis.keys(pattern)
        if keys:
            return redis.delete(*keys)
        return 0
    except Exception as e:
        logger.warning(f"⚠️  Cache pattern delete failed for pattern '{pattern}': {e}")
        return 0

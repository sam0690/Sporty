from __future__ import annotations

from app.core.redis import get_async_redis


_TOKEN_BUCKET_LUA = """
local key = KEYS[1]
local now_ms = tonumber(ARGV[1])
local rate_per_sec = tonumber(ARGV[2])
local capacity = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

local data = redis.call('HMGET', key, 'tokens', 'updated_at')
local tokens = tonumber(data[1])
local updated_at = tonumber(data[2])

if not tokens then
  tokens = capacity
  updated_at = now_ms
end

local elapsed_ms = math.max(0, now_ms - updated_at)
local refill = (elapsed_ms / 1000.0) * rate_per_sec

tokens = math.min(capacity, tokens + refill)

local allowed = 0
if tokens >= requested then
  tokens = tokens - requested
  allowed = 1
end

redis.call('HMSET', key, 'tokens', tokens, 'updated_at', now_ms)
redis.call('PEXPIRE', key, 120000)

return allowed
"""


class RedisTokenBucketLimiter:
    """Async Redis token-bucket rate limiter for provider API quotas."""

    async def allow(
        self,
        bucket_key: str,
        *,
        now_ms: int,
        rate_per_sec: float,
        capacity: int,
        requested_tokens: int = 1,
    ) -> bool:
        redis = await get_async_redis()
        allowed = await redis.eval(
            _TOKEN_BUCKET_LUA,
            1,
            bucket_key,
            now_ms,
            rate_per_sec,
            capacity,
            requested_tokens,
        )
        return bool(allowed)

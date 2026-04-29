from __future__ import annotations

import asyncio
import logging
from collections import defaultdict

from fastapi import WebSocket
import redis.asyncio as aioredis

from app.core.metrics import ws_active_connections, ws_messages_sent_total

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Redis pub/sub fan-out manager for match and leaderboard streams."""

    def __init__(self, redis: aioredis.Redis):
        self.redis = redis
        self.active: dict[str, set[WebSocket]] = defaultdict(set)
        self._tasks: dict[WebSocket, asyncio.Task] = {}

    async def connect(self, ws: WebSocket, channel: str) -> None:
        await ws.accept()
        self.active[channel].add(ws)
        ws_active_connections.labels(self._channel_type(channel)).inc()
        self._tasks[ws] = asyncio.create_task(self._listen(ws, channel))

    async def disconnect(self, ws: WebSocket, channel: str) -> None:
        task = self._tasks.pop(ws, None)
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        self.active[channel].discard(ws)
        ws_active_connections.labels(self._channel_type(channel)).dec()

    async def _listen(self, ws: WebSocket, channel: str) -> None:
        pubsub = self.redis.pubsub()
        await pubsub.subscribe(channel)
        try:
            async for message in pubsub.listen():
                if message.get("type") != "message":
                    continue
                payload = message.get("data")
                if payload is None:
                    continue
                if isinstance(payload, bytes):
                    await ws.send_text(payload.decode("utf-8"))
                else:
                    await ws.send_text(str(payload))
                ws_messages_sent_total.labels(self._channel_type(channel)).inc()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("WebSocket channel listener failed for channel=%s", channel)
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.close()
            self.active[channel].discard(ws)

    @staticmethod
    def _channel_type(channel: str) -> str:
        if channel.startswith("leaderboard:"):
            return "leaderboard"
        return "match"

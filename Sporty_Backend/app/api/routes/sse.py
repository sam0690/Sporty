from __future__ import annotations

import asyncio

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.api.deps import (
    get_async_redis_dep,
    require_match_access,
)

router = APIRouter(tags=["Realtime"])


@router.get("/match/{match_id}/leaderboard/stream")
async def leaderboard_stream(
    match_id: str,
    _match=Depends(require_match_access),
    redis=Depends(get_async_redis_dep),
):
    live_key = _match.external_api_id or str(_match.id)
    channel = f"leaderboard:{live_key}"

    async def event_stream():
        pubsub = redis.pubsub()
        await pubsub.subscribe(channel)
        try:
            async for message in pubsub.listen():
                if message.get("type") != "message":
                    continue
                payload = message.get("data")
                if payload is None:
                    continue
                if isinstance(payload, bytes):
                    data = payload.decode("utf-8")
                else:
                    data = str(payload)
                yield f"data: {data}\n\n"
        except asyncio.CancelledError:
            raise
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub.close()

    return StreamingResponse(event_stream(), media_type="text/event-stream")

from __future__ import annotations

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect

from app.api.deps import (
    require_match_access_ws,
    settings,
)
from app.services.connection_manager import ConnectionManager
from app.api.deps import get_connection_manager

router = APIRouter(tags=["Realtime"])


@router.websocket("/ws/match/{match_id}")
async def match_websocket(
    match_id: str,
    ws: WebSocket,
    _match=Depends(require_match_access_ws),
    manager: ConnectionManager = Depends(get_connection_manager),
) -> None:
    live_key = _match.external_api_id or str(_match.id)
    channel = f"{settings.REDIS_PUBSUB_PREFIX}:{live_key}"
    await manager.connect(ws, channel)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(ws, channel)


@router.websocket("/ws/leaderboard/{match_id}")
async def leaderboard_websocket(
    match_id: str,
    ws: WebSocket,
    _match=Depends(require_match_access_ws),
    manager: ConnectionManager = Depends(get_connection_manager),
) -> None:
    live_key = _match.external_api_id or str(_match.id)
    channel = f"leaderboard:{live_key}"
    await manager.connect(ws, channel)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(ws, channel)

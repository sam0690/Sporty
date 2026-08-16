from __future__ import annotations

import asyncio
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from app.api.deps import (
    get_async_redis_dep,
    get_current_active_user_async,
    require_match_access_ws,
)
from app.core.database import AsyncSessionLocal
from app.league.models import (
    League,
    LeagueMembership,
    LeagueMembershipStatus,
)

router = APIRouter(tags=["Realtime"])


def _draft_channel(league_id: uuid.UUID) -> str:
    """Must match app.league.router.draft_channel — the draft publish side."""
    return f"league:{league_id}:draft"


@router.get("/match/{match_id}/leaderboard/stream")
async def leaderboard_stream(
    match_id: str,
    # The _ws variant, despite the name: same public check, but it owns and
    # closes its session instead of holding one for the stream's whole life.
    _match=Depends(require_match_access_ws),
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


@router.get("/leagues/{league_id}/draft/stream")
async def league_draft_stream(
    league_id: str,
    user=Depends(get_current_active_user_async),
    redis=Depends(get_async_redis_dep),
):
    """Server-Sent Events stream of a league's draft lifecycle.

    Every active member subscribes while sitting in the league's "waiting room";
    when the commissioner starts the draft the backend publishes `draft_started`
    and each member's browser navigates into the draft room in real time — no
    polling. On connect (and on any EventSource auto-reconnect) we emit the
    current status first, so a client that joins late or reloads acts
    immediately without waiting for the next event.
    """
    try:
        league_uuid = uuid.UUID(league_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="League not found"
        )

    # Own session, closed before the stream starts: a Depends(get_async_db)
    # here would pin a pooled connection for as long as the EventSource stays
    # open (same bug as the WebSocket deps — see app/api/deps.py).
    async with AsyncSessionLocal() as db:
        # Only active members may subscribe — the draft room is member-scoped.
        membership = (
            await db.execute(
                select(LeagueMembership).where(
                    LeagueMembership.league_id == league_uuid,
                    LeagueMembership.user_id == user.id,
                    LeagueMembership.status == LeagueMembershipStatus.ACTIVE,
                )
            )
        ).scalar_one_or_none()
        if membership is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Not a league member"
            )

        league = (
            await db.execute(select(League).where(League.id == league_uuid))
        ).scalar_one_or_none()
        if league is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="League not found"
            )
        # Read what the snapshot needs while the session is still open — the
        # generator below runs long after it closes.
        current_status = league.status.value if league.status else None
        current_deadline = (
            league.draft_pick_deadline_at.isoformat()
            if league.draft_pick_deadline_at
            else None
        )

    channel = _draft_channel(league_uuid)

    async def event_stream():
        # Snapshot first — self-heals late joiners and reconnects. Includes
        # the current pick deadline so a client joining mid-draft (not just
        # mid-lobby) has a clock immediately, without waiting for the next
        # draft_turn_update.
        snapshot = json.dumps(
            {
                "type": "draft_status",
                "league_id": str(league_uuid),
                "status": current_status,
                "pick_deadline_at": current_deadline,
            }
        )
        yield f"data: {snapshot}\n\n"

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

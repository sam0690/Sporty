from __future__ import annotations

import uuid

from fastapi import Depends, HTTPException, Request, WebSocket, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import User
from app.core.security import decode_access_token
from app.core.config import settings
from app.core.database import get_async_db
from app.core.redis import create_redis_pool, get_async_redis
from app.league.models import League, LeagueMembership, LeagueMembershipStatus
from app.match.models import Match
from app.services.connection_manager import ConnectionManager


async def get_connection_manager(websocket: WebSocket) -> ConnectionManager:
    # This dependency is used by the WebSocket routes only, so it must take the
    # WebSocket (not a Request) — FastAPI injects WebSocket for ws handlers, and
    # asking for `request: Request` here crashes ws connects with a TypeError
    # ("missing 1 required positional argument: 'request'"), closing the socket
    # immediately and killing all live updates. Both share `.app.state`.
    app = websocket.app
    manager = getattr(app.state, "connection_manager", None)
    if manager is not None:
        return manager

    redis = await create_redis_pool()
    manager = ConnectionManager(redis=redis)
    app.state.connection_manager = manager
    return manager


async def get_async_redis_dep():
    return await get_async_redis()


def _extract_bearer_token(value: str | None) -> str | None:
    if not value:
        return None
    parts = value.strip().split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip()


async def get_current_active_user_async(request: Request, db=Depends(get_async_db)) -> User:
    token = _extract_bearer_token(request.headers.get("Authorization"))
    token = token or request.cookies.get("access_token")
    if token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token")

    user = (
        await db.execute(select(User).where(User.id == payload.sub))
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")
    return user


async def get_current_active_user_ws(ws: WebSocket, db=Depends(get_async_db)) -> User:
    token = _extract_bearer_token(ws.headers.get("Authorization"))
    token = token or ws.cookies.get("access_token")
    token = token or ws.query_params.get("token")
    if token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token")

    user = (
        await db.execute(select(User).where(User.id == payload.sub))
    ).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")
    return user


async def ensure_user_can_access_match(
    db: AsyncSession, *, match_id: str, user_id: uuid.UUID | None = None
) -> Match:
    match = None
    try:
        match_uuid = uuid.UUID(match_id)
        match = (await db.execute(select(Match).where(Match.id == match_uuid))).scalar_one_or_none()
    except ValueError:
        match = None

    if match is None:
        match = (await db.execute(select(Match).where(Match.external_api_id == match_id))).scalar_one_or_none()
    if match is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Match not found")

    # Matches are a public discovery surface — anyone (authenticated or not) may
    # open a match's detail + stream. `user_id` is accepted but unused, kept for
    # call-site compatibility / future per-user logic.
    return match


async def require_match_access(
    match_id: str,
    db: AsyncSession = Depends(get_async_db),
) -> Match:
    # Public: no auth required — the match detail (score/events/lineups) is
    # viewable by anyone, mirroring the public /matches list + /fixtures page.
    return await ensure_user_can_access_match(db, match_id=match_id)


async def require_match_access_ws(
    match_id: str,
    db: AsyncSession = Depends(get_async_db),
) -> Match:
    # Public: no auth required on the match event stream either.
    return await ensure_user_can_access_match(db, match_id=match_id)


async def require_league_member_ws(
    league_id: uuid.UUID,
    ws: WebSocket,
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user_ws),
) -> League:
    # Async-session mirror of app/league/dependencies.py::require_league_member
    # — unlike the public match stream, league chat needs real membership
    # auth, so this composes with get_current_active_user_ws rather than
    # being public.
    _ = ws
    league = (
        await db.execute(select(League).where(League.id == league_id))
    ).scalar_one_or_none()
    if league is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="League not found")

    is_member = (
        await db.execute(
            select(LeagueMembership).where(
                LeagueMembership.league_id == league_id,
                LeagueMembership.user_id == current_user.id,
                LeagueMembership.status == LeagueMembershipStatus.ACTIVE,
            )
        )
    ).scalar_one_or_none()
    if is_member is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this league",
        )
    return league


__all__ = [
    "get_async_db",
    "get_connection_manager",
    "get_async_redis_dep",
    "get_current_active_user_async",
    "get_current_active_user_ws",
    "ensure_user_can_access_match",
    "require_match_access",
    "require_match_access_ws",
    "require_league_member_ws",
    "settings",
]

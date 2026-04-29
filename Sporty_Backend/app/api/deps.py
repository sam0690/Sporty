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
from app.league.models import LeagueMembership, LeagueSport
from app.match.models import Match
from app.services.connection_manager import ConnectionManager


async def get_connection_manager(request: Request) -> ConnectionManager:
    manager = getattr(request.app.state, "connection_manager", None)
    if manager is not None:
        return manager

    redis = await create_redis_pool()
    manager = ConnectionManager(redis=redis)
    request.app.state.connection_manager = manager
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


async def ensure_user_can_access_match(db: AsyncSession, *, user_id: uuid.UUID, match_id: str) -> Match:
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

    membership_exists = (
        await db.execute(
            select(LeagueMembership.id)
            .join(LeagueSport, LeagueSport.league_id == LeagueMembership.league_id)
            .where(LeagueMembership.user_id == user_id)
            .where(LeagueSport.sport_id == match.sport_id)
            .limit(1)
        )
    ).scalar_one_or_none()
    if membership_exists is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to access this match stream",
        )

    return match


async def require_match_access(
    match_id: str,
    current_user: User = Depends(get_current_active_user_async),
    db: AsyncSession = Depends(get_async_db),
) -> Match:
    return await ensure_user_can_access_match(db, user_id=current_user.id, match_id=match_id)


async def require_match_access_ws(
    match_id: str,
    current_user: User = Depends(get_current_active_user_ws),
    db: AsyncSession = Depends(get_async_db),
) -> Match:
    return await ensure_user_can_access_match(db, user_id=current_user.id, match_id=match_id)


__all__ = [
    "get_async_db",
    "get_connection_manager",
    "get_async_redis_dep",
    "get_current_active_user_async",
    "get_current_active_user_ws",
    "ensure_user_can_access_match",
    "require_match_access",
    "require_match_access_ws",
    "settings",
]

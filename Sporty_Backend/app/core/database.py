"""Async SQLAlchemy engine/session utilities for realtime services.

The engine is created lazily on first use rather than at import time:
importing this module must never require a valid async DB URL (tests and
tooling import app modules under throwaway sqlite configs, and an eager
create_async_engine would raise before anything runs).
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

_async_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_async_engine() -> AsyncEngine:
    global _async_engine
    if _async_engine is None:
        # Expect asyncpg URL in env for async workflows.
        async_database_url = settings.DATABASE_URL.replace(
            "postgresql://", "postgresql+asyncpg://", 1
        )
        _async_engine = create_async_engine(
            async_database_url,
            pool_pre_ping=True,
            future=True,
        )
    return _async_engine


def _get_session_factory() -> async_sessionmaker[AsyncSession]:
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            bind=get_async_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
            autocommit=False,
        )
    return _session_factory


def AsyncSessionLocal() -> AsyncSession:
    """Create a new async session (kept callable like the old sessionmaker)."""
    return _get_session_factory()()


async def get_async_db():
    """FastAPI dependency yielding an async SQLAlchemy session."""
    async with AsyncSessionLocal() as session:
        yield session

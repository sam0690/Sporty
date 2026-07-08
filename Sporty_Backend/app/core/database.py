"""Async SQLAlchemy engine/session utilities for realtime services.

The engine is created lazily on first use rather than at import time:
importing this module must never require a valid async DB URL (tests and
tooling import app modules under throwaway sqlite configs, and an eager
create_async_engine would raise before anything runs).
"""

from __future__ import annotations

from urllib.parse import parse_qs, urlencode, urlsplit, urlunsplit

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import settings

_async_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def _to_asyncpg_url(database_url: str) -> tuple[str, dict]:
    """Rewrite a psycopg2-style URL for asyncpg.

    asyncpg doesn't accept the libpq `sslmode` query param (it raises
    "connect() got an unexpected keyword argument 'sslmode'") — it wants an
    `ssl` connect_arg instead. Strip sslmode from the URL and translate it
    to connect_args so hosts that require TLS (Render/Neon-style managed
    Postgres, `sslmode=require` in DATABASE_URL) still connect over TLS
    instead of the async engine failing to construct at all.
    """
    parts = urlsplit(database_url)
    query = parse_qs(parts.query)
    sslmode = query.pop("sslmode", [None])[0]
    new_query = urlencode(query, doseq=True)
    rebuilt = urlunsplit((parts.scheme, parts.netloc, parts.path, new_query, parts.fragment))

    connect_args: dict = {}
    if sslmode and sslmode != "disable":
        connect_args["ssl"] = True

    return rebuilt, connect_args


def get_async_engine() -> AsyncEngine:
    global _async_engine
    if _async_engine is None:
        # Expect asyncpg URL in env for async workflows.
        async_database_url = settings.DATABASE_URL.replace(
            "postgresql://", "postgresql+asyncpg://", 1
        )
        async_database_url, connect_args = _to_asyncpg_url(async_database_url)
        _async_engine = create_async_engine(
            async_database_url,
            pool_pre_ping=True,
            future=True,
            connect_args=connect_args,
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

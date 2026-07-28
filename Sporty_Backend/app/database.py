import time
from contextvars import ContextVar

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base

from app.core.config import settings
from app.core.metrics import db_queries_per_request, db_query_duration_seconds

# Engine — the bridge between SQLAlchemy and PostgreSQL
engine = create_engine(
    settings.DATABASE_URL,
    pool_size=20,
    max_overflow=20,
    pool_timeout=30,
    pool_pre_ping=True,
)

# Per-request SQL query counter. Set at request start by the metrics
# middleware, incremented per statement below, observed at request end.
# Holds a MUTABLE list ([count]) rather than an int on purpose: BaseHTTPMiddleware
# runs the endpoint in a child task, so a plain ContextVar.set() in the SQL event
# (child context) wouldn't propagate back to the middleware. Mutating a shared
# list object is visible across both contexts.
# ponytail: single global contextvar, not a full query-profiler; upgrade to
# per-statement sampling only if the histogram isn't enough to find the hog.
_query_count: ContextVar[list] = ContextVar("db_query_count", default=[0])


def reset_query_count() -> None:
    _query_count.set([0])


def get_query_count() -> int:
    return _query_count.get()[0]


@event.listens_for(engine, "before_cursor_execute")
def _before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    context._query_start_time = time.perf_counter()


@event.listens_for(engine, "after_cursor_execute")
def _after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    start = getattr(context, "_query_start_time", None)
    if start is not None:
        db_query_duration_seconds.observe(time.perf_counter() - start)
    _query_count.get()[0] += 1

# SessionLocal — each request gets its own session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base — all ORM models inherit from this
Base = declarative_base()


def get_db():
    """FastAPI dependency that provides a DB session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

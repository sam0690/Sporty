from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from app.core.config import settings

# Engine — the bridge between SQLAlchemy and PostgreSQL
engine = create_engine(
    settings.DATABASE_URL,
    pool_size=20,
    max_overflow=20,
    pool_timeout=30,
    pool_pre_ping=True,
)

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

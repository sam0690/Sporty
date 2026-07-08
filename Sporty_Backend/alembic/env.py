"""Alembic environment configuration."""

from logging.config import fileConfig
import os
from dotenv import load_dotenv

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# Load environment variables from .env
load_dotenv()

# Import YOUR Base and all models
from app.database import Base

# Import ALL model modules so Alembic can detect them
from app.auth import models as auth_models  # noqa: F401
from app.league import models as league_models  # noqa: F401
from app.match import models as match_models  # noqa: F401
from app.ingestion import models as ingestion_models  # noqa: F401
from app.player import models as player_models  # noqa: F401
from app.player import models_nba as player_models_nba  # noqa: F401
from app.scoring import models as scoring_models  # noqa: F401
from app.admin import models as admin_models  # noqa: F401
from app.support import models as support_models  # noqa: F401
from app.notification import models as notification_models  # noqa: F401
from app.league_chat import models as league_chat_models  # noqa: F401
# These two were missing entirely — without them Alembic doesn't know these
# tables exist and every autogenerate run proposes DROPPING live_events and
# match_feed_cache (real, in-use tables), which had to be hand-trimmed out of
# the last two migrations. Registering them here is the actual fix.
from app.models.db import live_event as live_event_models  # noqa: F401
from app.models.db import match_feed_cache as match_feed_cache_models  # noqa: F401

# Alembic Config object
config = context.config

# Override sqlalchemy.url with DATABASE_URL from .env
database_url = os.getenv("DATABASE_URL")
if not database_url:
    raise ValueError("DATABASE_URL not found in environment variables")
# Escape '%' so ConfigParser interpolation doesn't choke on URL-encoded
# passwords (e.g. %23, %40) in DATABASE_URL.
config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set target metadata for autogenerate
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
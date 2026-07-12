"""Baseline test environment.

conftest.py imports before any test module, so required Settings fields are
guaranteed present no matter which module pytest collects first. Several test
modules set their own DATABASE_URL (sqlite temp files) and os.chdir away from
the repo root — once that happens .env is unreachable and any module that
forgot a required env var (historically REDIS_URL) blew up Settings()
construction for the whole run. setdefault keeps explicit per-module
overrides working.
"""

from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "postgresql://sporty:sporty@localhost:5432/sporty_test")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("JWT_SECRET_KEY", "x" * 32)
os.environ.setdefault("GOOGLE_CLIENT_ID", "test-client")
os.environ.setdefault("FEEDER_SECRET", "test-feeder-secret-not-for-production")

# Several test modules run Base.metadata.create_all against throwaway SQLite
# databases, but some models carry PostgreSQL-only DDL: TransferWindow has an
# ExcludeConstraint (btree_gist overlap guard) and LiveEvent.meta is JSONB.
# Map both to SQLite-friendly forms when compiling DDL for SQLite — behaviour
# on PostgreSQL (models + alembic migrations) is untouched.
from sqlalchemy.dialects.postgresql import JSONB, ExcludeConstraint
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.schema import CreateIndex


@compiles(ExcludeConstraint, "sqlite")
def _skip_exclude_constraint_on_sqlite(element, compiler, **kw):
    return None


@compiles(JSONB, "sqlite")
def _render_jsonb_as_json_on_sqlite(element, compiler, **kw):
    return "JSON"


# TeamGameweekLineup's uq_one_captain_per_team_window / uq_one_vice_captain_
# per_team_window are PARTIAL unique indexes (postgresql_where=is_captain/
# is_vice_captain = TRUE) — correct on Postgres, but SQLAlchemy silently
# drops postgresql_where for non-postgres dialects, so SQLite would create a
# FULL unique index on (fantasy_team_id, transfer_window_id) instead —
# blocking every multi-player lineup insert, captain or not. Skip both by
# name on SQLite, same "Postgres-only DDL, no-op elsewhere" treatment as
# ExcludeConstraint above.
_SQLITE_SKIP_PARTIAL_INDEXES = {
    "uq_one_captain_per_team_window",
    "uq_one_vice_captain_per_team_window",
}


@compiles(CreateIndex, "sqlite")
def _skip_postgres_only_partial_indexes_on_sqlite(element, compiler, **kw):
    if element.element.name in _SQLITE_SKIP_PARTIAL_INDEXES:
        return ""
    return compiler.visit_create_index(element, **kw)

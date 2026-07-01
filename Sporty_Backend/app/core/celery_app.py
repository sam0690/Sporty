"""Celery application configuration.

Uses Redis as:
- broker (queue)
- result backend (optional)

Run:
  celery -A app.core.celery_app.celery_app worker --loglevel=INFO
  celery -A app.core.celery_app.celery_app beat --loglevel=INFO
"""

from __future__ import annotations

from celery import Celery

# Import all models FIRST, same as app/main.py, so SQLAlchemy registers every
# class before any task's db.query() triggers mapper configuration. A worker
# process never runs main.py's import block, so without this, the first query
# touching a relationship declared as a string (e.g. League -> "User") fails
# with "failed to locate a name" as soon as that mapper gets configured.
from app.auth.models import User, RefreshToken  # noqa: F401
from app.league.models import (  # noqa: F401
    Sport, Season, TransferWindow, League, LeagueSport, LineupSlot,
    LeagueMembership, FantasyTeam, TeamPlayer, Transfer, BudgetTransaction,
    TeamGameweekLineup, TeamWeeklyScore,
)
from app.match.models import Match  # noqa: F401
from app.player.models import (  # noqa: F401
    Player, PlayerGameweekStat, FootballStat, CricketStat, PlayerPriceHistory,
)
from app.player.models_nba import NBAStat  # noqa: F401
from app.ingestion.models import IngestionPlayer, IngestionTeam  # noqa: F401
from app.notification.models import Notification  # noqa: F401
from app.scoring.models import DefaultScoringRule, LeagueScoringOverride  # noqa: F401

from app.core.config import settings
from app.tasks.celery_schedule import CELERY_BEAT_SCHEDULE


celery_app = Celery(
    "sporty",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
  include=[
    "app.tasks.sync_tasks",
    "app.tasks.live_polling_tasks",
    "app.tasks.scoring_tasks",
    "app.tasks.pricing_tasks",    "app.tasks.transfer_tasks",  ],
)

celery_app.conf.update(
    timezone="UTC",
    enable_utc=True,
    broker_connection_retry_on_startup=True,
    accept_content=["json"],
    task_serializer="json",
    result_serializer="json",
    beat_schedule=CELERY_BEAT_SCHEDULE,
    # Nothing in this codebase ever reads a task result back (grep confirms
    # the only .get()/AsyncResult usage is ad-hoc debugging) — every task is
    # fire-and-forget. Upstash's redis over TLS occasionally times out on the
    # result-backend round-trip, which otherwise surfaces as a false "Task
    # raised unexpected: TimeoutError" even though the task's actual DB work
    # already committed. app/services/scoring/trigger.py already worked
    # around this per-call with ignore_result=True; this makes it the default
    # everywhere instead of relying on every call site remembering to set it.
    task_ignore_result=True,
)

# Explicitly import task modules so they're registered on app import.
# (Celery can lazy-load these at worker startup, but this makes local
# imports and beat/worker behavior more predictable.)
from app.tasks import sync_tasks as _sync_tasks  # noqa: F401,E402
from app.tasks import live_polling_tasks as _live_polling_tasks  # noqa: F401,E402
from app.tasks import scoring_tasks as _scoring_tasks  # noqa: F401,E402
from app.tasks import pricing_tasks as _pricing_tasks  # noqa: F401,E402
from app.tasks import transfer_tasks as _transfer_tasks  # noqa: F401,E402

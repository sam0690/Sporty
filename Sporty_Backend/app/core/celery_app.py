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
from app.scoring.models import DefaultScoringRule  # noqa: F401

from app.core.config import settings
from app.tasks.celery_schedule import CELERY_BEAT_SCHEDULE

# Worker/beat run as separate processes from the API — main.py's Sentry init
# never reaches them, so init here too. CeleryIntegration auto-reports any
# task that raises, even ones with no explicit try/except.
if settings.SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.celery import CeleryIntegration

    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        integrations=[CeleryIntegration()],
        traces_sample_rate=0,
        send_default_pii=False,
    )


celery_app = Celery(
    "sporty",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
  include=[
    "app.tasks.sync_tasks",
    "app.tasks.live_polling_tasks",
    "app.tasks.scoring_tasks",
    "app.tasks.pricing_tasks",    "app.tasks.transfer_tasks",
    "app.tasks.draft_tasks",
  ],
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
    # The broker is Upstash redis over TLS, consumed from a machine whose
    # network can blink or suspend. With no socket timeout the consumer's
    # blocking read on a half-open socket never returns and never raises: the
    # worker goes silent (won't even answer `inspect ping`) while beat keeps
    # publishing. That is exactly what happened 2026-08-18 — 29 hours of live
    # polls piled up 3,525 deep and a real La Liga fixture never got fetched.
    #
    # socket_timeout must exceed BRPOP's own wait (kombu polls with a short
    # one) but stay well under the hourly football poll, so a dead socket is
    # noticed and reconnected within one beat interval of any task.
    broker_transport_options={
        "socket_timeout": 30,
        "socket_connect_timeout": 10,
        "socket_keepalive": True,
        "health_check_interval": 30,
        # Redelivery deadline for an un-acked message. Must be >= the longest
        # task or a slow run gets handed to a second worker mid-flight; the
        # squad-seeding/backfill style syncs are the long pole at ~10 min.
        "visibility_timeout": 1800,
    },
    # Second wedge path: a provider call that hangs forever parks a pool child
    # instead of the consumer (stats.nba.com soft-blocks exactly like this).
    # Soft limit gives the task a SoftTimeLimitExceeded to clean up; the hard
    # limit kills the child. 10 min is above every real task's runtime.
    task_soft_time_limit=540,
    task_time_limit=600,
)

# Explicitly import task modules so they're registered on app import.
# (Celery can lazy-load these at worker startup, but this makes local
# imports and beat/worker behavior more predictable.)
from app.tasks import sync_tasks as _sync_tasks  # noqa: F401,E402
from app.tasks import live_polling_tasks as _live_polling_tasks  # noqa: F401,E402
from app.tasks import scoring_tasks as _scoring_tasks  # noqa: F401,E402
from app.tasks import pricing_tasks as _pricing_tasks  # noqa: F401,E402
from app.tasks import transfer_tasks as _transfer_tasks  # noqa: F401,E402

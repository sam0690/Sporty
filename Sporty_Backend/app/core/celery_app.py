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
    "app.tasks.pricing_tasks",
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
)

# Explicitly import task modules so they're registered on app import.
# (Celery can lazy-load these at worker startup, but this makes local
# imports and beat/worker behavior more predictable.)
from app.tasks import sync_tasks as _sync_tasks  # noqa: F401,E402
from app.tasks import live_polling_tasks as _live_polling_tasks  # noqa: F401,E402
from app.tasks import scoring_tasks as _scoring_tasks  # noqa: F401,E402
from app.tasks import pricing_tasks as _pricing_tasks  # noqa: F401,E402

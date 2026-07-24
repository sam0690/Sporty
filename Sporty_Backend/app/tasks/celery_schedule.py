"""Celery Beat schedule definitions."""

from celery.schedules import crontab


CELERY_BEAT_SCHEDULE = {
    # ── Football via API-Football (free tier: 100 req/day, budget 95 —
    # see FOOTBALL_API_DAILY_BUDGET). All three tasks no-op while
    # LIVE_POLLING_ENABLED / the live_polling_enabled admin flag is off.
    #
    # Daily request math (worst-case EPL Saturday): fixtures 3 + predictions
    # ~10 + live snapshots ≤4 + reconcile date queries ~2 + FT stat sheets
    # ~10 ≈ 30. The budget guard clips gracefully either way.
    "sync-football-matches-daily": {
        "task": "sync.football.matches",
        "schedule": crontab(minute=0, hour=6),
        "args": (),  # league 39 / current season defaults
    },
    "sync-football-predictions-daily": {
        "task": "sync.football.predictions",
        "schedule": crontab(minute=0, hour=7),
        "args": (),
    },
    # Public competition pages: standings/scorers/matches snapshots (current
    # season). ~9 football-data.org calls/day; historical seasons load on
    # demand and cache forever.
    "sync-football-competition-data-daily": {
        "task": "sync.football.competition_data",
        "schedule": crontab(minute=30, hour=6),
        "args": (),
    },
    # Coarse by design (user decision 2026-07-25: 3h, quota-conscious). Scores
    # still land mostly after full time via the reconcile pass (books finals +
    # FT stat sheets for matches that started and ended between ticks) — a 3h
    # tick only occasionally lands mid-match for live in-play points. Idle
    # ticks cost zero requests (DB window gate). For genuinely live UX, tighten
    # to crontab(minute="*/5") — still fits the 95/day budget (~1 req/poll,
    # gated to match windows; FT sheets + predictions dominate the daily total,
    # not the poll interval).
    "poll-live-football-every-3h": {
        "task": "live.football.poll",
        "schedule": crontab(minute=30, hour="*/3"),
        "args": (),
    },

    # Daily sync (players change less often) — run manually after transfer
    # windows for now; ~40 requests per full-league run (paginated).
    # "sync-football-players-daily": {
    #     "task": "sync.football.players",
    #     "schedule": crontab(minute=0, hour=3),
    #     "args": (),
    # },
    # Catch just-finished matches
    # "sync-finished-match-stats-every-15m": {
    #     "task": "sync.stats.finished",
    #     "schedule": crontab(minute="*/15"),
    #     "args": (),
    # },
    # "poll-live-nba-every-4h": {
    #     "task": "live.nba.poll",
    #     "schedule": crontab(minute=0, hour="*/4"),
    #     "args": (),
    # },
    # "poll-live-cricket-every-1m": {
    #     "task": "live.cricket.poll",
    #     "schedule": crontab(minute="*/1"),
    #     "args": (),
    # },

    # Scoring refresh (safe to run even if no active windows)
    "score-active-transfer-windows-every-10-min": {
        "task": "score.active_transfer_windows",
        "schedule": 600.0,
        "args": (),
    },
    # Auto-lock transfer windows when deadlines pass (every 5 min — cheap
    # work, but each run costs a Redis lock acquire/release against Upstash's
    # free-tier command quota, so every-1-min was more precision than needed)
    "auto-lock-transfer-windows-every-5-min": {
        "task": "transfer.auto_lock_expired",
        "schedule": crontab(minute="*/5"),
        "args": (),
    },
    # Auto-lock lineup windows when deadlines pass (every 5 min, same reason)
    "auto-lock-lineup-windows-every-5-min": {
        "task": "lineup.auto_lock_expired",
        "schedule": crontab(minute="*/5"),
        "args": (),
    },
    # Reprice player market values from recent transfer-window performance.
    "recalculate-player-prices-daily": {
        "task": "pricing.recalculate",
        "schedule": crontab(minute=30, hour=4),
        "args": (3,),
    },
}

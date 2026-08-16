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
    # Hourly (2026-08-16, was 3h). At 3h a 105-minute match got at most ONE
    # in-play sample — La Liga fixture 1570333 got exactly one and it landed on
    # the halftime whistle, so the entire second half was never polled.
    #
    # Measured worst day on the real season calendar (20 fixtures, 11:30-19:30):
    #   polls          12   (1 req/tick; fixtures?live=all covers EVERY league
    #                        in one request, so cost is per-tick, not per-match)
    #   reconcile     ~10   (1 date query per distinct kickoff day, per tick)
    #   FT sheets      20   (1 per finishing fixture)
    #   predictions    20   (1 per fixture, cached — re-runs cost nothing)
    #   fixture sync    3
    #   ------------------
    #   TOTAL         ~65 / 95 budget  (FOOTBALL_API_DAILY_BUDGET)
    #
    # Idle ticks cost zero requests (the DB window gate in
    # _fixtures_in_live_window returns no candidates → no API call at all).
    # Next step up if tighter liveness is wanted: crontab(minute="*/30") ≈ 78.
    # Do NOT go to */15 (≈90) or */5 (≈179) — those blow the free tier.
    "poll-live-football-every-1h": {
        "task": "live.football.poll",
        "schedule": crontab(minute=30),  # every hour at :30
        "args": (),
    },
    # Team stats (possession/shots/xG) skipped at full time because the day's
    # budget was inside the reserve. Capped at 5 fixtures and a 14-day lookback,
    # so it can never run away into the ~380 finished 2024/25 fixtures.
    #
    # HOURLY, not once a day at the quota reset, because Beat does not run
    # around the clock — a single fixed UTC moment is simply missed if the
    # machine running Beat is asleep, and the fixture then never gets stats at
    # all. An idle tick costs ZERO API requests and one indexed query: with
    # nothing missing the task returns before touching the client, and when
    # something is missing it still yields to FOOTBALL_LINEUP_QUOTA_RESERVE, so
    # it naturally succeeds early in the UTC day and skips later.
    "backfill-football-team-stats-hourly": {
        "task": "sync.football.team_stats_backfill",
        "schedule": crontab(minute=20),
        "args": (),
    },
    # Re-parse the full-time sheet for matches that finished 3h+ ago. Booking
    # happens once, at the finish transition, so a player the sheet couldn't
    # resolve in that moment scores zero for a match they played, forever —
    # and any later improvement to resolution never reaches them. Hourly for
    # the same reason as the backfill above (Beat is not up around the clock);
    # an idle tick costs nothing, and each match is re-booked exactly once.
    "rebook-football-match-stats-hourly": {
        "task": "sync.football.stats_rebook",
        "schedule": crontab(minute=40),
        "args": (),
    },
    # ── SportScore (keyless, ~10k req/day) — display-only liveness ──
    # The hourly poll above stays exactly as it is: it remains the ONLY source
    # of full-time stats, fantasy points, and the flip to 'finished'. This tick
    # just makes the score and event feed current in between, which the free
    # API-Football tier cannot pay for.
    #
    # Cost: ~10 concurrent fixtures x 60 ticks/hr ~= 600 requests on a heavy
    # Saturday, against their ~10,000/day/IP. No budget guard needed.
    # Idle ticks are free — the same DB window gate as the football poll means
    # no in-play fixture => no outbound request at all.
    "poll-live-sportscore-every-60s": {
        "task": "live.sportscore.poll",
        "schedule": 60.0,
        "args": (),
    },
    # Confirmed lineups land ~1h before kick-off, which the hourly live poll
    # would miss by up to an hour (its window opens at kickoff-5min). This is
    # deliberately tighter, and it is FREE to run tight: each fixture is
    # fetched exactly once (Redis + MatchFeedCache guard) and ticks with no
    # fixture near kick-off make zero API calls. 30 min rather than 5 only to
    # keep Upstash command usage modest, same reasoning as the entries below.
    #
    # Adds ~1 request per fixture (~20 on the worst day, ~65 -> ~85 of 95), so
    # it yields the last FOOTBALL_LINEUP_QUOTA_RESERVE requests to the finals
    # and FT stat sheets — those run post-match and must not be starved by a
    # cosmetic pre-match fetch.
    "sync-football-lineups-every-30m": {
        "task": "sync.football.lineups",
        "schedule": crontab(minute="*/30"),
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

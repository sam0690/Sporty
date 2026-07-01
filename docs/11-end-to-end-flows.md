# 11 — End-to-End Flows

This chapter stitches all the pieces together into concrete traces. Each step names the real
function/endpoint so you can follow it through the code.

## Flow A — A user plays a season (the happy path)

1. **Sign up / log in.** Frontend `AuthProvider.register/login` → `POST /api/v1/auth/register|login`
   → backend sets httpOnly `access_token`+`refresh_token` cookies → frontend calls `GET /auth/me` to
   populate `user`. ([03](03-auth-and-security.md), [09](09-frontend-architecture.md))
2. **Create/join a league.** `LeagueService.createLeague` → `POST /api/v1/leagues` →
   `services.create_league` writes the `League`, attaches `LeagueSport` rows, auto-enrols the owner as
   a `LeagueMembership`. Or `POST /leagues/join` with an invite code. ([04](04-leagues-and-lifecycle.md))
3. **Build a squad.**
   - *Draft league*: owner `POST /draft/start` (randomizes draft order, creates a `FantasyTeam` per
     member, → DRAFTING). Each user `POST /draft/pick` on their **snake-order** turn until the last
     pick auto-transitions the league to ACTIVE.
   - *Budget league*: user `POST /teams/build` with a valid squad under budget, or `POST /auto-pick`
     (PuLP ILP suggests a squad) then build. ([05](05-squads-transfers-optimization.md))
4. **Generate windows.** Owner `POST /transfer-windows/generate` creates weekly `TransferWindow`s with
   transfer + lineup deadlines.
5. **Each gameweek:**
   - Before the transfer deadline: stage transfers (`/api/v1/transfers/stage-out|stage-in|confirm`,
     Redis session) or a single `POST /leagues/{id}/transfers`.
   - Before the lineup deadline: `PATCH /my-team/lineup` sets the starting XI + captain + vice for the
     **editable** window.
   - Deadlines pass → Celery Beat `transfer.auto_lock_expired` / `lineup.auto_lock_expired` flip the
     lock flags (every 5 min). ([07](07-background-jobs.md))
6. **Matches are played** (see Flow B) → stats booked → scoring runs → `TeamWeeklyScore` + rankings.
7. **Leaderboard.** `GET /leagues/{id}/leaderboard` shows per-window or season-total standings
   (honoring late-join eligibility and historical membership). ([06](06-scoring-ranking-pricing.md))
8. **Prices drift.** Daily/4-hourly pricing jobs move `players.cost` from form + demand, recording
   `PlayerPriceHistory`. ([06](06-scoring-ranking-pricing.md))
9. **Season ends.** The daily lifecycle job transitions the league ACTIVE → COMPLETED on `end_date`.

## Flow B — A simulated match becomes fantasy points (the full trace)

This is the money path — the thing the whole architecture exists to make seamless. Every hop:

```
┌── FEEDER ──────────────────────────────────────────────────────────────────────┐
│ POST /demo/launch (or POST /simulate)                                           │
│  • schedule_match  ──▶ backend POST /feed/schedule-match ──▶ creates Match row   │
│  • resolve/register-players ──▶ backend maps/creates Player rows, links UUIDs    │
│  • start_simulation(): asyncio task, event_rates + home/away calibration         │
│                                                                                  │
│  every simulated minute:                                                         │
│   _sample_minute_events(): Bernoulli-sample each player's per-minute rates;      │
│                            couple assists to scoring events                      │
│   push_match_result(batch) ─────────────────────────────────────────────────────┼─┐
└──────────────────────────────────────────────────────────────────────────────────┘ │
                                                                                       │ HTTP + X-Feeder-Secret
┌── BACKEND: POST /api/v1/feed/match-result (app/api/v1/feed.py) ◀───────────────────┘
│  1. find Match; upsert events → live_events (ON CONFLICT (match_id,event_id) DO NOTHING)
│  2. update Match.home_score/away_score/status
│  3. publish SCORE_UPDATE  ──▶ Redis channel  match:{live_key}
│  4. apply_live_points(): HINCRBYFLOAT fantasy:match:{key}:player:{id};
│                          publish FANTASY_POINTS_DELTA ──▶ same Redis channel
│  5. on live→finished:
│       persist_match_stats(): fold live_events ──▶ PlayerGameweekStat + FootballStat/NBAStat
│       enqueue_scoring_for_finished_match(): Celery send_task score.transfer_window(window)
└──────────────────────────────────────────────────────────────────────────────────
        │ Redis pub/sub                                   │ Celery
        ▼                                                 ▼
┌── FRONTEND live view ──────────────┐        ┌── BACKEND worker: score.transfer_window ──┐
│ useMatchSocket: WS /api/ws/match/{id}│      │ score_transfer_window_for_season_leagues:  │
│  SCORE_UPDATE  → applyScoreUpdate    │      │  • player_scoring UPDATE (fantasy_points)  │
│  FANTASY_POINTS_DELTA → points tick  │      │  • upsert_team_weekly_scores (captain/vice)│
│ LiveMatchClient hydrates from        │      │  • apply_rankings (SQL RANK())             │
│  GET /api/match/{id}/state (snapshot)│      │  • invalidate leaderboard cache            │
└──────────────────────────────────────┘      └────────────────────────────────────────────┘
                                                          │
                                                          ▼
                                        GET /leagues/{id}/leaderboard reflects new standings
```

### Step-by-step

1. **Feeder schedules + links.** `demo.demo_launch` calls `backend_client.schedule_match` →
   backend `POST /feed/schedule-match` creates a `Match` (`external_api_id = feeder:<uuid>`) and
   returns `sporty_match_id`, which the feeder stores as an `entity_link`. Players are mapped the same
   way (`register-players` or `resolve-players`).
2. **Feeder simulates.** `run_simulation` samples per-minute events from `event_rates` (scaled by
   home/away calibration for realistic scorelines + home advantage), assigns UUID `event_id`s, and
   pushes **one batch per minute** to `POST /feed/match-result`. ([10](10-sporty-data-feeder.md))
3. **Backend ingests idempotently.** `ingest_match_result` upserts the batch into `live_events`
   (`ON CONFLICT DO NOTHING`), updates the `Match` score/status. ([08](08-live-match-pipeline.md))
4. **Backend streams live.** It publishes a `SCORE_UPDATE` and (via `apply_live_points`) per-player
   `FANTASY_POINTS_DELTA` messages to Redis channel `match:{live_key}`, incrementing the
   `fantasy:match:{key}:player:{id}` hashes. The frontend WebSocket (`useMatchSocket`) applies these
   into the Zustand `matchStore`, and the live page ticks the score and points in real time.
5. **On finish, backend books stats.** The live→finished push triggers `persist_match_stats`, which
   aggregates the match's `live_events` per player and folds them into `PlayerGameweekStat` +
   `FootballStat`/`NBAStat` for every window covering the match date (adding 90/48 minutes).
6. **Backend enqueues scoring.** `enqueue_scoring_for_finished_match` locates the window(s) and sends
   `score.transfer_window(window_id)` to Celery (throttled, best-effort).
7. **Worker scores.** `score_transfer_window_for_season_leagues` → for each league:
   `score_*_players_for_window` rewrites `fantasy_points` from the child stats × effective rules;
   `upsert_team_weekly_scores` sums each team's **starting-lineup** points and applies the
   **captain-doubles / vice-fallback** rule; `apply_rankings_for_league_window` sets `rank_in_league`
   via SQL `RANK()`. The leaderboard cache key is invalidated. ([06](06-scoring-ranking-pricing.md))
8. **User sees it.** The next `GET /leagues/{id}/leaderboard` reflects the new `TeamWeeklyScore` +
   ranks. If the on-finish enqueue failed, the 10-min `score.active_transfer_windows` sweep or the
   02:00 daily ranking job catches active windows. ([07](07-background-jobs.md))

### Why the live number matches the final number

The live per-event deltas (`feed_scoring.FOOTBALL_EVENT_POINTS`/`BASKETBALL_EVENT_POINTS`) are tuned
to the **same weights** the batch engine uses (`player_scoring.FOOTBALL_ACTIONS` and the NBA per-10
scheme). So the points ticking up during the match converge on the authoritative gameweek total the
scoring job computes at finish — no jarring correction.

## Flow C — Real-API mode (the future drop-in)

If someone sets `LIVE_POLLING_ENABLED=True` and uncomments the `live.*.poll` Beat entries, the
`football_live_sync`/`nba_live_sync` pollers replace steps 1–5 of Flow B: they **pull** live fixtures
+ events from API-Football/API-NBA, match them to existing `Match`/`Player` rows (numeric external ids
for football; folded-name+team for NBA), and then do the *exact same* `live_events` upsert →
`SCORE_UPDATE` publish → `apply_live_points` → `persist_match_stats` →
`enqueue_scoring_for_finished_match`. Because feeder rows use `feeder:` external ids and the pollers
only touch numeric ids, the two sources never collide. Everything from step 6 onward is unchanged.
This is the whole point of routing both sources through the same `Match`/`LiveEvent`/Redis model.
([08](08-live-match-pipeline.md))

## Flow D — Setting a lineup and why captain matters

1. User opens the lineup page for the **editable** (next not-yet-locked) window
   (`GET /leagues/{id}/editable-window` + `GET /my-team/lineup`).
2. They drag 11 starters into position (frontend @dnd-kit), pick a captain and vice, and submit
   `PATCH /my-team/lineup`.
3. `services.update_lineup` validates the window isn't locked, all players are owned, structural +
   position-slot rules pass, and captain≠vice — then replaces the `TeamGameweekLineup` rows.
4. When the gameweek scores, `upsert_team_weekly_scores` sums **only these starters**' points, and:
   - if the **captain played** (minutes > 0): the captain's points are added **twice** (doubled);
   - else if the captain got 0 minutes and the **vice played**: the **vice's** points double instead;
   - else: no bonus.

So the captain choice can swing a team's weekly total substantially — picking a captain who then
doesn't play falls back to the vice, and if neither plays you simply get the base lineup sum.

## Quick reference — where each responsibility lives

| Responsibility | Backend | Feeder | Frontend |
|----------------|---------|--------|----------|
| Auth | `app/auth/`, `app/core/security.py` | (shared secret only) | `context/auth-context.tsx`, `api/*-api-client.ts` |
| Leagues/draft | `app/league/services.py` | — | `features/create-*`, `hooks/leagues` |
| Transfers | `app/services/transfer_service.py`, `app/league/services.py` | — | `features/transfers` |
| Squad optimization | `app/services/optimization/`, `app/league/auto_pick_service.py` | — | `services/OptimizationService.ts` |
| Match events | `app/api/v1/feed.py`, `app/services/feed_scoring.py` | `services/simulation.py` | `store/matchStore.ts` |
| Scoring/ranking | `app/services/scoring/` | (match score only) `services/scoring_rules.py` | `hooks/scoring` |
| Pricing | `app/services/pricing/`, `app/services/price_update_service.py` | — | — |
| Live stream | `app/api/routes/`, `connection_manager.py` | push client `backend_client.py` | `hooks/useMatchSocket.ts`, `components/live/` |
| Background jobs | `app/tasks/`, `app/main.py` lifespan | asyncio sim task | — |
| ML/simulation | (dormant Kafka `app/consumers/`) | `services/features.py`, `ml_models.py`, `dixon_coles.py`, `simulation.py` | — |

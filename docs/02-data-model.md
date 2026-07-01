# 02 — Data Model (PostgreSQL)

The backend uses SQLAlchemy 2.0 typed models. Almost every table has a `uuid.uuid4` primary
key (no sequential IDs exposed), timezone-aware timestamps via `func.now()`, and rich
`CheckConstraint`/`UniqueConstraint`/`Index` guardrails. Schema is managed by Alembic
(`alembic/`). This chapter walks the model modules and explains why each table exists.

A note on **money and points**: costs, budgets, and points are `Numeric`/`Decimal`, never
float — the models comment on this explicitly (`app/league/models.py`): floats give
`0.1 + 0.2 = 0.30000…04`, unacceptable for budgets.

A note on **transaction ownership** (a repo-wide convention): service functions never call
`db.commit()`. The router or scheduler job that invoked them owns the transaction. Every
model relationship that crosses modules is declared with a **string target** (e.g.
`relationship("User")`) so there are no circular imports; SQLAlchemy resolves the names once
all model modules are imported. That import happens up-front in `app/main.py` (and,
critically, is mirrored in `app/core/celery_app.py` so worker processes resolve relationships too).

## Module map

| Module | Tables |
|--------|--------|
| `app/auth/models.py` | `users`, `refresh_tokens` |
| `app/league/models.py` | `sports`, `seasons`, `transfer_windows`, `leagues`, `league_sports`, `lineup_slots`, `league_memberships`, `fantasy_teams`, `team_players`, `transfers`, `budget_transactions`, `team_gameweek_lineups`, `team_weekly_scores`, `draft_picks` |
| `app/player/models.py` | `real_teams`, `players`, `player_price_history`, `player_gameweek_stats`, `football_stats`, `cricket_stats` |
| `app/player/models_nba.py` | `nba_stats` |
| `app/match/models.py` | `matches` |
| `app/scoring/models.py` | `default_scoring_rules`, `league_scoring_overrides` |
| `app/notification/models.py` | `notifications` |
| `app/models/db/live_event.py` | `live_events` |
| `app/ingestion/models.py` | `ingestion_players`, `ingestion_teams` (staging for CSV/API ingestion) |

## Identity & auth (`app/auth/models.py`)

- **`User`** — `username`, `email` (both unique), `auth_provider` enum (`local` | `google`),
  nullable `password_hash` and `google_id`, `avatar_url`, `is_active`, plus password-reset
  token state (only a **hash** of the reset token is stored). A DB `CheckConstraint`
  (`ck_user_auth_provider_fields`) enforces that a `local` user has a password hash and a
  `google` user has a google_id — you cannot create a half-broken user.
- **`RefreshToken`** — one user → many refresh tokens. The **raw token is never stored**;
  only its SHA-256 hash (`token_hash`). `is_active` is a property (not revoked and not
  expired). `create_for_user()` is a factory that returns `(db_object, raw_token)` — you
  persist the object and send the raw string to the client once. Rotation and revocation
  hang off this table.

## Sports, seasons, windows (`app/league/models.py`)

- **`Sport`** — `name` is a lowercase machine slug (`"football"`), `display_name` is the
  human label. `is_active` allows soft-disable; sports are never hard-deleted (FKs from
  seasons/players/rules block it).
- **`Season`** — belongs to a sport, has `start_date`/`end_date` (dates, not datetimes).
  `is_current` is a **derived property** (`start_date <= today <= end_date`), not a stored
  boolean — dates are the single source of truth so a stale cron can't lie. Overlap of two
  seasons for the same sport is prevented three ways: a check constraint, a unique constraint,
  and a PostgreSQL **`ExcludeConstraint`** on `daterange(...) && ` per sport (a GiST exclusion
  constraint — the DB physically refuses overlapping ranges).
- **`TransferWindow`** — the gameweek. Belongs to a season, has a `number`, timezone-aware
  `start_at`/`end_at`, and **two distinct deadlines**: `transfer_deadline_at` (buy/sell cutoff)
  and `lineup_deadline_at` (starting-XI cutoff). Invariant enforced by check constraints:
  `transfer_deadline_at < lineup_deadline_at <= end_at`. Two **explicit** lock flags
  (`transfers_locked`, `lineup_locked`) are flipped by a scheduler/admin — deliberately **not**
  derived from time, so an admin can lock early or extend. A `tstzrange` `ExcludeConstraint`
  prevents overlapping windows within a season.

## Leagues & membership

- **`League`** — owned by a user, tied to a season. Carries the invite code (8 chars from
  `secrets.token_urlsafe`, generated in the service layer), `status` (the lifecycle enum),
  `max_teams`, `budget_per_team` (`Numeric(12,2)`, default 103.00), `squad_size`,
  `draft_mode` (draft vs budget league), `transfers_per_window`, `transfer_day`, `is_public`,
  `allow_midseason_join`. `member_count`/`team_count`/`teams_detail` are computed properties.
  Child config (sports, slots, memberships, teams) cascades on delete.
- **`LeagueSport`** — join table (composite PK `league_id, sport_id`). A league can attach
  football + basketball for a mixed league. `ondelete=CASCADE` on the league side; no cascade
  on the sport side (blocks sport deletion).
- **`LineupSlot`** — per-league, per-sport position requirements: `position` code
  (`"GKP"`, `"DEF"`, …) with `min_count`/`max_count`. The service layer validates a submitted
  lineup against these.
- **`LeagueMembership`** — user ↔ league, with `status` (`active`|`left`), an optional
  `draft_position` (NULL before draft; PostgreSQL treats multiple NULLs as distinct so no
  conflict), and — importantly — **`eligible_from_window_id`**. That FK is NULL for members who
  joined at setup/draft (immediately eligible for points), and set to a window for late joiners
  in active budget leagues (they only start scoring from that window). Scoring and leaderboard
  queries honor this eligibility.
- **`FantasyTeam`** — one per user per league. Holds the **live** `current_budget`
  (`Numeric(10,2)`), plus snapshots `starting_budget`/`starting_squad_size` taken at creation.
  `status` is `active`|`archived`. `current_budget >= 0` is a check constraint.

## Roster & transfer history

- **`TeamPlayer`** — which players a team owns. Records `acquired_window_id` and a nullable
  `released_window_id` (NULL = still on the roster). This gives a full acquire/release history.
  A **partial unique index** (`uix_team_player_active`, `WHERE released_window_id IS NULL`)
  guarantees a player can't be actively on the same team twice while allowing historical rows.
  Also snapshots `sport_type` and `cost_at_acquisition`.
- **`Transfer`** — immutable audit log of a swap: `player_out_id`, `player_in_id`,
  `transfer_window_id`, `cost_at_transfer`. Check constraint: out ≠ in. A composite index on
  `(fantasy_team_id, transfer_window_id)` supports the hot "how many transfers this window?"
  query.
- **`BudgetTransaction`** — money ledger per team: `transaction_type` (constrained to
  `purchase`/`discard`/`transfer_out_refund`/`transfer_in_cost`), `amount`, `penalty_applied`.
- **`DraftPick`** — immutable, append-only record of every snake-draft pick: `round_number`,
  overall `pick_number`. Two unique constraints: `(league_id, pick_number)` (no two teams at
  the same slot) and `(league_id, player_id)` (a player is drafted once per league).

## Weekly lineup & scores

- **`TeamGameweekLineup`** — the starting XI for a team **per window**. Separate from
  `TeamPlayer` (own vs start). `is_captain`/`is_vice_captain` booleans. A single-row check
  forbids being both captain and vice; two **partial unique indexes**
  (`WHERE is_captain = TRUE` / `is_vice_captain = TRUE`) act as a DB-level safety net enforcing
  at most one captain and one vice per team per window (the service layer clears the old one
  first; the index catches bugs).
- **`TeamWeeklyScore`** — denormalized `points` per team per window, plus `rank_in_league`
  (NULL until the ranking job runs). Written once after scoring, read many times on
  leaderboards — the model comments explain the compute-once-read-many trade-off. Unique on
  `(fantasy_team_id, transfer_window_id)`.

## Players & stats (`app/player/models.py`, `models_nba.py`)

- **`RealTeam`** — normalized clubs/teams (name, abbreviation, external id). `Player.real_team`
  is a legacy string kept for compatibility; `Player.real_team_id` is the FK used by ingestion.
- **`Player`** — `sport_id`, optional unique `external_api_id`, `name`, `position` (string, not
  enum — positions vary across sports: `GKP`/`DEF`/… for football, `BAT`/`BOWL`/… for cricket,
  `UNK` for basketball), `real_team`(+FK), `cost` (`Numeric(10,2)`, fluctuates over the season),
  `is_available` (False = injured/suspended → can't be picked).
- **`PlayerPriceHistory`** — immutable audit of every price change: `old_cost`, `new_cost`,
  `delta`, `weighted_points`, `algorithm_version`, tied to the window it happened in.
- **`PlayerGameweekStat`** — the **sport-agnostic base stat**, one row per player per window:
  `minutes_played` and denormalized `fantasy_points`. This is the table the whole scoring +
  pricing system reads. It uses a **table-per-subtype** pattern: sport-specific detail lives in
  1:1 child tables.
  - **`FootballStat`** — goals, assists, clean_sheets, yellow/red cards, own_goals, penalties
    saved/missed, saves, goals_conceded, bonus. All non-negative, with sane caps (≤2 yellows,
    ≤1 red).
  - **`CricketStat`** — batting/bowling/fielding columns, all **nullable** (NULL = "did not
    bat/bowl", distinct from 0 = "batted and scored 0"). Explained at length in the model.
  - **`NBAStat`** (separate module) — points, assists, rebounds, steals, blocks.

  Each child links to the base via a `base_stat_id` FK that is **UNIQUE** (FK + UNIQUE = 1:1),
  reinforced by `uselist=False` on the relationship.

## Matches (`app/match/models.py`)

- **`Match`** — a real (or simulated) fixture: `sport_id`, **unique `external_api_id`**
  (`"12345"` for API-Football, `"feeder:<uuid5>"` for a simulated match), `home_team`/`away_team`
  strings, `match_date`, `status` (`scheduled`/`live`/`finished`/`postponed`/`cancelled`),
  nullable `home_score`/`away_score`, `competition`, `season`. The `external_api_id` prefix is
  what keeps simulated and real-API matches from colliding — feeder rows start with `feeder:`.

## Live events (`app/models/db/live_event.py`)

- **`LiveEvent`** — the append-only stream of in-match events (goal, card, basket, …).
  `match_id` here is the **live key** (a match's `external_api_id` or its UUID as string),
  `event_id` is the idempotency key, `event_type`, `player_id`/`team_id` (strings), `meta`
  (JSONB, holds `minute`, `source`, etc.), `ts`. A `UniqueConstraint(match_id, event_id)` makes
  ingestion idempotent — the feed handler upserts `ON CONFLICT DO NOTHING`, so feeder retries
  never double-book. On the live→finished transition these rows are aggregated into
  `PlayerGameweekStat`/child tables (see [08](08-live-match-pipeline.md)).

## Scoring config (`app/scoring/models.py`)

- **`DefaultScoringRule`** — the platform-admin canonical list: per-sport `action`
  (`"football_goal"`, `"yellow_card"`, …), `points` (`Numeric`, negatives allowed), and a
  human `description`. Unique on `(sport_id, action)`.
- **`LeagueScoringOverride`** — a league owner's override of a specific action's `points`.
  No description column (it JOINs to the default). Cascades on league delete. Unique on
  `(league_id, sport_id, action)`.

The **effective** points for a (league, sport, action) is: override → default → hardcoded
fallback → 0. That resolution lives in `app/services/scoring/rules.py:resolve_effective_rules`
(see [06](06-scoring-ranking-pricing.md)).

## Two database sessions

The backend keeps two engines (see `Sporty_Backend/CLAUDE.md`):
- **sync** — `app/database.py`, psycopg2, `SessionLocal`, `get_db` dependency, a 20+20
  connection pool with `pool_pre_ping`. Used by nearly all routers, services, and jobs.
- **async** — `app/core/database.py`, asyncpg, `get_async_db`. Used by realtime WebSocket/SSE
  paths only. Derives its URL by rewriting `postgresql://` → `postgresql+asyncpg://`.

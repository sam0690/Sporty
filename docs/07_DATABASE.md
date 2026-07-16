# 07 — Database

The backend uses **SQLAlchemy 2.0** typed models (`Mapped[...]` annotations) against
**PostgreSQL**, with schema evolution managed entirely by **Alembic**
(`Sporty_Backend/alembic/`). Almost every table uses a `uuid.uuid4()` primary key (no
sequential integer ids exposed to clients), timezone-aware timestamps via
`func.now()`, and deliberately heavy use of `CheckConstraint`/`UniqueConstraint`/
partial indexes/`ExcludeConstraint` to push invariants into the database itself
rather than trusting application code alone. See
[`diagrams/04_class_diagram.md`](../diagrams/04_class_diagram.md) and
[`diagrams/09_refined_class_diagram.md`](../diagrams/09_refined_class_diagram.md) for
the entity-relationship view.

Money and points columns are `Numeric`/`Decimal`, **never** `float` — the models
comment on this explicitly, because `0.1 + 0.2` in binary floating point is
`0.30000000000000004`, which is unacceptable for a budget ledger.

**Transaction ownership**: service functions never call `db.commit()`; the router or
scheduler job that invoked them owns the transaction (see [02 — Architecture](02_ARCHITECTURE.md)).

**Cross-module relationships** are declared with string targets
(`relationship("User")`), and every model module is imported up front in
`app/main.py` **and** `app/core/celery_app.py` so SQLAlchemy resolves those names
before any query runs (worker processes never execute `main.py`).

## Module map

| Module | Tables |
|---|---|
| `app/auth/models.py` | `users`, `refresh_tokens` |
| `app/league/models.py` | `sports`, `seasons`, `transfer_windows`, `leagues`, `league_sports`, `lineup_slots`, `league_memberships`, `fantasy_teams`, `team_players`, `transfers`, `budget_transactions`, `team_gameweek_lineups`, `team_weekly_scores`, `draft_picks`, `roster_moves`, `waiver_order`, `waiver_claims`, `trade_offers`, `points_penalties`, `league_matchups` |
| `app/player/models.py` | `real_teams`, `players`, `player_price_history`, `player_gameweek_stats`, `football_stats`, `cricket_stats`, `user_favourite_teams`, `user_favourite_players` |
| `app/player/models_nba.py` | `nba_stats` |
| `app/match/models.py` | `matches` |
| `app/scoring/models.py` | `default_scoring_rules` (`league_scoring_overrides` still exists in old databases but the model/endpoints were retired 2026-07) |
| `app/notification/models.py` | `notifications` |
| `app/models/db/live_event.py` | `live_events` |
| `app/models/db/match_feed_cache.py` | `match_feed_cache` |
| `app/support/models.py` | `support_tickets`, `ticket_messages` |
| `app/admin/models.py` | `system_config` (runtime feature-flag overrides), `admin_audit_logs` |
| `app/ingestion/models.py` | `ingestion_players`, `ingestion_teams` (staging for CSV/API ingestion) |

## Identity & auth (`app/auth/models.py`)

- **`users`** — `username`, `email` (both unique), `auth_provider` enum
  (`local`\|`google`), nullable `password_hash`/`google_id`, `avatar_url`,
  `is_active`, `email_notifications_enabled` (boolean, default `true` — added by
  migration `*_add_email_notifications_enabled_to_users`), plus password-reset token
  state (only the token's **hash** is stored). A `CheckConstraint`
  (`ck_user_auth_provider_fields`) enforces that a `local` user has a password hash
  and a `google` user has a `google_id`.
- **`refresh_tokens`** — one user → many. The raw token is never stored, only its
  SHA-256 hash. `is_active` is a derived property (not revoked, not expired).
  `RefreshToken.create_for_user()` returns `(db_object, raw_token)`; only the raw
  string goes to the client, once.

## Sports, seasons, windows (`app/league/models.py`)

- **`sports`** — `name` (lowercase machine slug), `display_name`, `is_active`
  (soft-disable only; hard delete blocked by FKs from seasons/players/rules).
- **`seasons`** — `start_date`/`end_date` (dates). `is_current` is a **derived
  property**, not a stored column. Overlap prevention is **triple-redundant**: a
  check constraint, a unique constraint, and a PostgreSQL GiST
  **`ExcludeConstraint`** on `daterange(...) &&` per sport — the database physically
  refuses overlapping season ranges even if application logic has a bug.
- **`transfer_windows`** — the gameweek. `number`, `start_at`/`end_at`, and **two**
  deadlines: `transfer_deadline_at` and `lineup_deadline_at`, with the invariant
  `transfer_deadline_at < lineup_deadline_at <= end_at` enforced by check
  constraints. Two **explicit** boolean lock flags (`transfers_locked`,
  `lineup_locked`) are set by a scheduler/admin, deliberately not derived from the
  current time so an operator can lock early or extend. A `tstzrange`
  `ExcludeConstraint` prevents overlapping windows within a season.

## Leagues & membership

- **`leagues`** — owner FK, season FK, 8-character invite code, `status` (lifecycle
  enum), `max_teams`, `budget_per_team` (`Numeric(12,2)`, default 103.00),
  `squad_size`, `draft_mode`, `transfers_per_window`, `transfer_day`, `is_public`,
  `allow_midseason_join`.
- **`league_sports`** — join table, composite PK `(league_id, sport_id)`.
  `ondelete=CASCADE` on the league side only.
- **`lineup_slots`** — per-league, per-sport position requirements: `position`
  code + `min_count`/`max_count`.
- **`league_memberships`** — user↔league, `status` (`active`\|`left`), optional
  `draft_position`, and **`eligible_from_window_id`** (NULL for setup/draft joiners;
  set to a window for late joiners in active budget leagues — scoring/leaderboard
  queries honor this).
- **`fantasy_teams`** — one per user per league. Live `current_budget`
  (`Numeric(10,2)`, `CHECK >= 0`), snapshots `starting_budget`/`starting_squad_size`,
  `status` (`active`\|`archived`).

## Roster & transfer history

- **`team_players`** — roster membership: `acquired_window_id` +
  nullable `released_window_id` (NULL = still on roster), `sport_type`,
  `cost_at_acquisition`. A partial unique index (`uix_team_player_active`, `WHERE
  released_window_id IS NULL`) prevents a player being active on the same team
  twice. **New columns (migration `f7a8b9c0d1e2_draft_roster_phase1`):**
  `league_id` (denormalized from `fantasy_teams.league_id`, backfilled, `NOT NULL`,
  FK `ondelete=CASCADE`, indexed) and `is_draft` (boolean snapshot of
  `league.draft_mode` at acquisition time) — both added so the free-agent pool query
  and the ownership-uniqueness index below avoid joining through `fantasy_teams`/
  `leagues` on every read.
- **`uq_draft_active_player_ownership`** — a **partial unique index** on
  `team_players(league_id, player_id) WHERE released_window_id IS NULL AND is_draft
  = true`. This is the database-level enforcement of the platform's core
  draft-league invariant: *a player belongs to at most one team per league at any
  instant*. It only applies to draft leagues — budget/classic leagues intentionally
  allow the same real player to be owned by multiple managers' fantasy squads
  simultaneously (there's no scarcity model there).
- **`transfers`** — immutable audit log: `player_out_id`, `player_in_id`,
  `transfer_window_id`, `cost_at_transfer`. `CHECK (player_out_id != player_in_id)`.
- **`budget_transactions`** — money ledger: `transaction_type` (constrained to
  `purchase`/`discard`/`transfer_out_refund`/`transfer_in_cost`), `amount`,
  `penalty_applied`.
- **`draft_picks`** — immutable, append-only: `round_number`, `pick_number`. Unique
  on `(league_id, pick_number)` and `(league_id, player_id)`.
- **`points_penalties`** — immutable ledger of league-points deductions per team.
  Currently written with `reason='budget_overage'` when a manager pays a
  transfer's budget shortfall with points (at the global
  `BUDGET_OVERAGE_POINTS_RATE`); `reason` is a free string so future penalty
  types reuse the table. Deductions surface on the dashboard and leaderboard.
- **`roster_moves`** *(new, migration `f7a8b9c0d1e2`)* — audit trail for every
  free-agent/waiver/trade/draft roster change: `league_id`, `fantasy_team_id`,
  `move_type` (`CHECK IN ('draft','free_agent','waiver','trade','dynasty_carryover')`
  — the last written by a dynasty-mode league renewal carrying rosters into the new
  season),
  `add_player_id`/`drop_player_id` (nullable — a pure add or pure drop has one
  null), `window_id`, `actor_user_id` (`ON DELETE SET NULL` — the audit row survives
  user deletion). Indexed on `league_id`, `fantasy_team_id`, `created_at`.

## Draft-league roster management: waivers & trades (new, migration `a8b9c0d1e2f3`)

Three tables implement an FPL-Draft-style waiver/trade system for **draft leagues
only** (budget leagues use the transfer flow instead — see
[05 — Squads, Transfers & Optimization content folded into 06/08](06_ALGORITHMS.md)).

- **`waiver_order`** — one row per team per league: `position` (smallint, the
  priority rank). Unique on `(league_id, fantasy_team_id)` and
  `(league_id, position)` — no two teams share a priority slot. Initialized in
  **reverse draft order** when a draft completes; a successful waiver claim moves
  that team to the back of the queue (rolling waivers, the FPL default).
- **`waiver_claims`** — one row per submitted claim: `add_player_id`,
  `drop_player_id` (both required — a waiver claim is always an add+drop pair),
  `process_window_id` (which gameweek's waiver run this claim is queued for),
  `claim_priority` (smallint, a per-team ordering when a manager submits multiple
  claims), `priority_snapshot` (the team's `waiver_order.position` at claim time, for
  audit/tie-break), `status` (`CHECK IN ('pending','success','failed','cancelled')`),
  `failure_reason` (free text, e.g. "player already claimed by higher priority").
- **`trade_offers`** — `from_team_id`/`to_team_id`, `offered_player_ids`/
  `requested_player_ids` (plain `JSON` arrays of player UUIDs — not a join table,
  since a trade offer is a single atomic proposal, not a queryable many-to-many
  relationship), `status` (`CHECK IN ('proposed','accepted','rejected','cancelled',
  'vetoed','executed')`), `veto_deadline` (set on acceptance — a 24h commissioner
  veto window before an accepted trade actually executes).

**Could not determine from the codebase** whether `offered_player_ids`/
`requested_player_ids` being plain `JSON` rather than `JSONB` was a deliberate choice
or an oversight — `JSONB` is used elsewhere in the schema (`live_events.meta`,
`match_feed_cache.payload`) and is generally preferred in PostgreSQL for indexable/
queryable JSON.

## Weekly lineup & scores

- **`team_gameweek_lineups`** — the lineup for a team **per window**.
  `is_captain`/`is_vice_captain` booleans (one check constraint forbids both; two
  partial unique indexes cap one captain/one vice per team per window). **New
  columns (migration `d5e6f7a8b9c0_add_lineup_starter_bench`):** `is_starter`
  (boolean, `NOT NULL`, `server_default TRUE` — backfills every pre-existing row as
  a starter) and `bench_order` (smallint, nullable, `NULL` for starters, `0` = first
  substitute priority). Before this migration only starters were persisted at all;
  storing the bench (with an explicit priority order) is what makes FPL-style
  automatic substitution (see [06 — Algorithms](06_ALGORITHMS.md) and
  `app/services/scoring/auto_subs.py`) possible — a starter who records 0 minutes is
  swapped for the highest-priority bench player who **did** play, provided the
  resulting XI still satisfies the league's position rules.
- **`team_weekly_scores`** — denormalized `points` per team per window,
  `rank_in_league` (NULL until the ranking job runs). Unique on
  `(fantasy_team_id, transfer_window_id)`.

## Players & stats

- **`real_teams`** — normalized clubs/teams (name, abbreviation, external id).
  **New column:** `logo_url` (`String(500)`, nullable — migration
  `9e36efaf1840_add_photo_url_and_logo_url...`).
- **`players`** — `sport_id`, optional unique `external_api_id`, `name`, `position`
  (free string, not an enum, since position vocab differs per sport), `real_team`
  (legacy string) + `real_team_id` FK, `cost` (`Numeric(10,2)`), `is_available`.
  **New columns:** `photo_url` (`String(500)`, nullable) and, from a **separate**
  migration (`*_69edd8db7d_add_real_team_logo_url_to_players`),
  `real_team_logo_url` (`String(500)`, nullable — a denormalized per-player copy of
  the club crest URL, distinct from `real_teams.logo_url`). **Could not determine**
  from the migrations alone why the club logo is stored in two places
  (`real_teams.logo_url` and `players.real_team_logo_url`); the frontend commit
  history (`"redesign team crest and player photos rendering"`) suggests it was
  added to avoid a join on hot player-list reads, but this is inferred, not
  confirmed in code comments.
- **`player_price_history`** — immutable: `old_cost`, `new_cost`, `delta`,
  `weighted_points`, `algorithm_version`, tied to the window it happened in.
- **`player_gameweek_stats`** — the sport-agnostic base stat, one row per player per
  window: `minutes_played`, denormalized `fantasy_points`. Table-per-subtype
  pattern with three 1:1 child tables, each linked via a **unique** FK
  (`base_stat_id`, enforced `uselist=False` on the ORM relationship):
  - **`football_stats`** — goals, assists, clean_sheets, yellow/red cards, own
    goals, penalties saved/missed, saves, goals_conceded, bonus — all non-negative
    with sane caps (≤2 yellows, ≤1 red). **Note:** the penalties-saved/missed
    columns exist in this schema, but the current data source (the feeder) never
    simulates penalty kicks — see [05 — Simulation Engine](05_SIMULATION_ENGINE.md).
    These columns are only populated when a real-API sync path (currently disabled)
    reports a penalty event.
  - **`cricket_stats`** — batting/bowling/fielding columns, all **nullable** (NULL =
    "did not bat/bowl", distinct from `0` = "batted and scored 0").
  - **`nba_stats`** (`app/player/models_nba.py`) — points, assists, rebounds,
    steals, blocks.

- **`user_favourite_teams`** / **`user_favourite_players`** — a user's favourite
  club and player, **one per sport** (`UniqueConstraint(user_id, sport_id)`),
  replacing the old single `User.favourite_team_id`/`favourite_player_id` columns.
  FKs to `users`/`sports`/`real_teams`-or-`players` with `ON DELETE CASCADE`, so
  deleting the favourited entity removes the favourite without a trigger. Drives
  the personalized "your player scored" notifications and is set during the
  post-signup onboarding step (editable later in Profile Settings).

### Data-quality migration: `e6f7a8b9c0d1_dedupe_players`

This is a **data migration**, not a schema migration — worth documenting because it
reveals a real, previously-live bug class. Different importers assigned different
`external_api_id` namespaces to the *same* real player (roster syncs used
`"nba:<id>"`/`"football:<id>"`; the feeder used `"feeder:player:<id>"`), and each
importer only deduped against its own namespace, so a player synced under two
namespaces produced **two rows** with two different costs (feeder-created rows
floored around 4.8–5.2). The migration, in one transaction: groups rows by
`(sport_id, folded name, real_team)`, picks a canonical row per group (prefer a
non-`feeder:` row → most gameweek stats → higher cost → lowest id), repoints every
foreign key from the duplicates to the canonical row (deleting conflicting
UNIQUE-constrained child rows first), deletes the now-orphaned duplicates, and
verifies no group still has more than one row (aborting the whole transaction if so).
It is idempotent — a second run is a no-op — and it is **not reversible** (deleted
rows cannot be reconstructed). It explicitly does **not** add a uniqueness
constraint, because the importers themselves needed to learn to match by
name+team before that constraint could hold — a follow-up the migration's own
docstring flags as still outstanding. See [14 — Improvements](14_IMPROVEMENTS.md).

## Matches & live events

- **`matches`** — `sport_id`, **unique** `external_api_id` (`"12345"` for
  API-Football, `"feeder:<uuid5>"` for a simulated match — the prefix is what keeps
  the two sources from ever colliding over the same row), `home_team`/`away_team`
  free-text strings, `match_date`, `status` (`scheduled`/`live`/`finished`/
  `postponed`/`cancelled`), nullable `home_score`/`away_score`, `competition`,
  `season`.
- **`live_events`** — the append-only in-match event stream. `match_id` here is the
  **live key** (a match's `external_api_id` or its UUID string), `event_id` is the
  idempotency key, `event_type`, `player_id`/`team_id` (strings), `meta` (JSONB),
  `ts`. `UniqueConstraint(match_id, event_id)` makes ingestion idempotent
  (`ON CONFLICT DO NOTHING`).
- **`match_feed_cache`** *(new, migration `9aa8a1dd3a3d`)* — a **durable backstop**
  for feeder pushes (prediction/ratings/lineups) that are otherwise Redis-only with
  a 24-hour TTL. `match_id` FK (`ON DELETE CASCADE`), `kind` (`"prediction"` \|
  `"ratings"` \| `"lineups"`), `payload` (JSONB), `created_at`/`updated_at`. Unique
  on `(match_id, kind)`. Redis stays the fast hot-path read; once a Redis entry
  expires, a `GET` falls back to this table instead of returning nothing.

## Scoring config

- **`default_scoring_rules`** — per-sport `action` + `points` (`Numeric`, negatives
  allowed) + `description`. Unique on `(sport_id, action)`.
- **`league_scoring_overrides`** — **retired** (2026-07). The table may still
  exist in previously-migrated databases, but the ORM model and the
  set/remove-override endpoints are gone: `fantasy_points` is read by
  league-unaware consumers (auto-pick valuation, pricing, "my team" display), so
  scoring is `DefaultScoringRule`-only platform-wide.

## Head-to-head matchups (`app/league/models.py`)

- **`league_matchups`** — the full-season H2H schedule for leagues with
  `League.is_head_to_head=true`, one row per pairing per transfer window:
  `league_id`, `transfer_window_id`, `home_team_id`, nullable `away_team_id`
  (NULL = bye), `home_points`/`away_points` (`Numeric(8,2)`, filled when the
  window's scoring finalizes), `result`
  (`home_win`/`away_win`/`tie`/`bye`, NULL while unresolved). Generated once by
  the circle-method round robin at the ACTIVE transition and never regenerated —
  see [06 — Algorithms](06_ALGORITHMS.md) §11.

## Support & admin (`app/support/models.py`, `app/admin/models.py`)

- **`support_tickets`** — a user's ticket: subject, category, status
  (open/in-progress/resolved/closed), priority, optional assignee (an admin-tier
  user).
- **`ticket_messages`** — the conversation thread on a ticket; admin replies can be
  flagged internal-only (invisible to the ticket's owner).
- **`system_config`** — runtime feature-flag overrides (e.g. the dormant Kafka
  realtime pipeline, live external-API polling) editable from the admin console
  without a redeploy.
- **`admin_audit_logs`** — append-only record of every admin action (who, what,
  target, when), surfaced in the admin console's audit-log page.

## Entity-relationship overview

See [`diagrams/04_class_diagram.md`](../diagrams/04_class_diagram.md) for the
structural (attributes/methods) view and
[`diagrams/09_refined_class_diagram.md`](../diagrams/09_refined_class_diagram.md) for
the expanded version including the new draft-roster tables. The key structural
insight: **`TransferWindow`** (the gameweek) is the hub nearly every time-scoped
table hangs off — lineups, scores, stats, and eligibility are all keyed to a window.

## Two database sessions

- **Sync** — `app/database.py`, `psycopg2`, `SessionLocal`, the `get_db` dependency,
  a 20+20 connection pool with `pool_pre_ping`. Used by nearly all routers,
  services, and scheduled jobs.
- **Async** — `app/core/database.py`, `asyncpg`, `get_async_db`. Used **only** by the
  realtime WebSocket/SSE/match-state routes. Its URL is derived from the same
  `DATABASE_URL` by rewriting the driver prefix.

## Migration strategy

Alembic-managed, linear revision history (`alembic/versions/`), no branches
observed. The Docker `CMD` (`Sporty_Backend/Dockerfile`) runs `alembic upgrade head`
as a **hard gate** before starting Uvicorn — the API process will not boot on a
failed migration. Non-destructive seed scripts (`create_sports.py`,
`seed_default_scoring_rules.py`) run immediately after, in a subshell whose failure
is deliberately swallowed (they're idempotent upserts of reference data, not a
reason to keep the API from serving traffic). `Sporty_Backend/CLAUDE.md` instructs
always reading an autogenerated migration file before applying it (enum ordering is
a known autogenerate footgun). See `Sporty_Backend/migration_commands.sh` for the
full checklist. The feeder's database is migrated the same way, independently, via
its own `alembic/`.

## Explain Like I'm New

Think of PostgreSQL as one big, extremely strict filing cabinet. "Strict" is the key
word: instead of trusting the application code to always double-check things like
"a team can't have two captains" or "a season can't overlap another season for the
same sport," the filing cabinet itself refuses to file a folder that breaks those
rules — even if a programmer forgets to check first. That's what all the
`CheckConstraint`/`UniqueConstraint`/`ExcludeConstraint` machinery is: rules baked
into the cabinet, not just the person filing things.

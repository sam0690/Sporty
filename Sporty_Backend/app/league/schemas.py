"""
League module Pydantic schemas.

Rules applied:
  1. Response schemas are security boundaries — no internal IDs where names
     suffice, no cascade-sensitive FKs, no admin-only fields.
  2. Nested objects over raw UUIDs in responses.
  3. model_config = ConfigDict(from_attributes=True) on every response schema.
  4. Validators on create schemas — lengths, ranges, formats.
  5. Response schema ≠ ORM model.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

from app.league.models import LeagueMembershipStatus
from app.league.models import LeagueStatus
from app.league.models import DEFAULT_TEAM_BUDGET
from app.schemas.common import (
    TransferWindowBrief,
    PlayerBrief,
    SeasonBrief,
    SportBrief,
    UserBrief,
)


# ═══════════════════════════════════════════════════════════════════════════════
# League
# ═══════════════════════════════════════════════════════════════════════════════


class LeagueCreate(BaseModel):
    """POST /leagues — what the user sends to create a league."""
    name: str = Field(min_length=2, max_length=100)
    season_id: uuid.UUID
    is_public: bool = False
    max_teams: int = Field(default=10, ge=2, le=64)
    squad_size: int = Field(default=15, ge=1, le=30)
    budget_per_team: Decimal = Field(default=DEFAULT_TEAM_BUDGET, gt=0, max_digits=12, decimal_places=2)
    draft_mode: bool = Field(default=False)
    is_head_to_head: bool = Field(default=False)
    allow_midseason_join: bool = Field(default=False)
    transfers_per_window: int = Field(default=4, ge=0, le=10)
    transfer_day: int = Field(default=1, ge=1, le=7)
    start_date: date | None = None
    end_date: date | None = None
    sports: list[str] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("League name cannot be blank")
        return v.strip()


# ═══════════════════════════════════════════════════════════════════════════════
# LeagueSport (defined before LeagueResponse so it can be embedded)
# ═══════════════════════════════════════════════════════════════════════════════


class LeagueSportAdd(BaseModel):
    """POST /leagues/{id}/sports — attach a sport to a league.

    Uses sport_name (slug) instead of sport_id.

    Why?
      API clients (frontend, mobile) don't know sport UUIDs.
      They know "football" because that's what the UI displays and
      what GET /sports returns as the machine-readable slug.

      The service layer looks up the Sport by name → gets the UUID
      internally. This keeps the public API clean and human-readable:
        {"sport_name": "football"}  vs  {"sport_id": "a1b2c3d4-..."}
    """
    sport_name: str = Field(min_length=1, max_length=50)

    @field_validator("sport_name")
    @classmethod
    def sport_name_lowercase(cls, v: str) -> str:
        stripped = v.strip().lower()
        if not stripped:
            raise ValueError("Sport name cannot be blank")
        return stripped


class LeagueSportResponse(BaseModel):
    """What gets returned — nested sport, not raw sport_id."""
    sport: SportBrief
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ═══════════════════════════════════════════════════════════════════════════════
# League
# ═══════════════════════════════════════════════════════════════════════════════


class LeagueTeamDetail(BaseModel):
    """Team details for league response."""
    team_name: str
    team_owner: UserBrief
    joined_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MyTeamBrief(BaseModel):
    """The requesting user's team within a league.

    Attached to LeagueResponse so the leagues list can render each card's
    team name, season rank, and total points without a per-league round-trip.
    None when the user has no (active) team in that league yet.
    """
    id: uuid.UUID
    name: str
    rank: int | None = None
    points: Decimal = Decimal("0")

    model_config = ConfigDict(from_attributes=True)


class LeagueResponse(BaseModel):
    """What gets returned when reading a league.

    Note what's exposed vs hidden:
      ✅ id, name, invite_code, status, settings, owner, season, sports
      ❌ owner_id (raw FK) — replaced by nested owner object
      ❌ season_id (raw FK) — replaced by nested season object
      ❌ updated_at — internal bookkeeping, not useful to clients

    sports: The first thing a UI needs when displaying a league card
      is "what sport(s) is this league for?" Without this, the frontend
      would need a separate request to GET /leagues/{id}/sports.
    """
    id: uuid.UUID
    name: str
    invite_code: str
    status: str
    is_public: bool
    max_teams: int
    squad_size: int
    budget_per_team: Decimal
    # Canonical squad-shape rules (app/league/sportConfigs.py) — one source of
    # truth the frontend reads instead of hardcoding numbers that could drift.
    position_minimums: dict[str, int] = {}
    max_per_club: int
    draft_mode: bool
    is_head_to_head: bool
    allow_midseason_join: bool
    transfers_per_window: int
    transfer_day: int
    season_number: int = 1
    created_at: datetime
    member_count: int = 0
    team_count: int = 0
    joinable_now: bool | None = None
    midseason_entry_window_number: int | None = None
    midseason_join_message: str | None = None

    # Nested objects instead of raw UUIDs
    owner: UserBrief
    season: SeasonBrief
    # Sports attached to this league — list because multi-sport leagues exist
    sports: list[LeagueSportResponse] = []

    # Team details with owner and membership join timestamp
    teams_detail: list[LeagueTeamDetail] = []

    # The requesting user's own team in this league (name/rank/points).
    # Populated by the service on user-scoped list endpoints; None otherwise.
    my_team: MyTeamBrief | None = None

    model_config = ConfigDict(from_attributes=True)


# ═══════════════════════════════════════════════════════════════════════════════
# LineupSlot
# ═══════════════════════════════════════════════════════════════════════════════


class LineupSlotCreate(BaseModel):
    """POST /leagues/{id}/lineup-slots — define position requirements.

    Uses sport_name (slug) instead of sport_id — same reasoning as
    LeagueSportAdd: clients know "football", not UUIDs.
    """
    sport_name: str = Field(min_length=1, max_length=50)
    position: str = Field(min_length=1, max_length=20)
    min_count: int = Field(ge=0, le=15)
    max_count: int = Field(ge=0, le=15)

    @field_validator("sport_name")
    @classmethod
    def sport_name_lowercase(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("position")
    @classmethod
    def position_uppercase(cls, v: str) -> str:
        return v.strip().upper()

    @field_validator("max_count")
    @classmethod
    def max_gte_min(cls, v: int, info) -> int:
        min_count = info.data.get("min_count")
        if min_count is not None and v < min_count:
            raise ValueError("max_count must be >= min_count")
        return v


class LineupSlotResponse(BaseModel):
    """Position slot config — nested sport instead of sport_id."""
    id: uuid.UUID
    sport: SportBrief
    position: str
    min_count: int
    max_count: int

    model_config = ConfigDict(from_attributes=True)


# ═══════════════════════════════════════════════════════════════════════════════
# Membership
# ═══════════════════════════════════════════════════════════════════════════════


class MembershipResponse(BaseModel):
    """Who is in the league — public member info.

    Note:
      ✅ user (nested), draft_position, joined_at
      ❌ league_id — caller already knows which league they queried
      ❌ user_id (raw FK) — replaced by nested user object
    """
    id: uuid.UUID
    user: UserBrief
    status: LeagueMembershipStatus
    draft_position: int | None = None
    joined_at: datetime
    eligible_from_window_id: uuid.UUID | None = None

    model_config = ConfigDict(from_attributes=True)


# ═══════════════════════════════════════════════════════════════════════════════
# FantasyTeam
# ═══════════════════════════════════════════════════════════════════════════════


class FantasyTeamCreate(BaseModel):
    """POST /leagues/{id}/teams — user creates their fantasy team."""
    name: str = Field(min_length=2, max_length=100)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Team name cannot be blank")
        return v.strip()


class FantasyTeamResponse(BaseModel):
    """Public fantasy team info — what OTHER managers see.

    current_budget is intentionally ABSENT from this public response.

    Why?
      In FPL, your budget is PRIVATE — other managers can't see it.
      Knowing a rival's budget reveals their transfer strategy:
        "They have 15M left, they can afford Haaland next week."

    Two-schema approach:
      - FantasyTeamResponse      → public view (no budget) — used in
        leaderboards, league member lists, draft pick displays.
      - FantasyTeamOwnerResponse → private view (WITH budget) —
        returned only when the requesting user IS the team owner.

    The router/service decides which schema to use based on
    current_user.id == fantasy_team.user_id.
    """
    id: uuid.UUID
    name: str
    owner: UserBrief = Field(alias="user")
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class TeamPlayerResponse(BaseModel):
    """Minimal roster entry for a team owner view.

    Points fields are populated by get_user_team from PlayerGameweekStat:
      - total_points   — season fantasy points (sum across the season's windows)
      - avg_points     — total_points / gameweeks the player has been scored in
      - gameweek_points — the active window's points ("this gameweek")
    All default to 0 pre-season / before any scoring has run.
    """

    player: PlayerBrief
    joined_at: datetime = Field(alias="created_at")
    total_points: Decimal = Decimal("0")
    avg_points: Decimal = Decimal("0")
    gameweek_points: Decimal = Decimal("0")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class FantasyTeamOwnerResponse(FantasyTeamResponse):
    """Private view — only the team OWNER sees their budget.

    Inherits everything from FantasyTeamResponse and adds current_budget.
    The router returns this schema when current_user owns the team.
    """
    current_budget: Decimal
    players: list[TeamPlayerResponse] = Field(default_factory=list, alias="team_players")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ═══════════════════════════════════════════════════════════════════════════════
# DraftPick
# ═══════════════════════════════════════════════════════════════════════════════


class DraftPickResponse(BaseModel):
    """GET /leagues/{id}/draft — each pick in the draft history.

    Note what's exposed:
      ✅ round_number, pick_number, player (nested), team (nested), picked_at
      ❌ league_id — caller already knows which league
      ❌ fantasy_team_id, player_id (raw FKs) — replaced by nested objects
    """
    id: uuid.UUID
    round_number: int
    pick_number: int
    player: PlayerBrief
    fantasy_team: FantasyTeamResponse
    picked_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ═══════════════════════════════════════════════════════════════════════════════
# TeamWeeklyScore
# ═══════════════════════════════════════════════════════════════════════════════


class TeamWeeklyScoreResponse(BaseModel):
    """GET /leagues/{id}/leaderboard — one row per team per transfer window.

    Used for leaderboard display. Includes the transfer window context so the
    frontend knows which window's scores it's showing.
    """
    id: uuid.UUID
    fantasy_team: FantasyTeamResponse
    transfer_window: TransferWindowBrief
    points: Decimal
    rank_in_league: int | None = None

    model_config = ConfigDict(from_attributes=True)


# ═══════════════════════════════════════════════════════════════════════════════
# Leaderboard (Phase 7)
# ═══════════════════════════════════════════════════════════════════════════════


class LeaderboardEntry(BaseModel):
    """GET /leagues/{id}/leaderboard?transfer_window_id=... — one row per team.

    Returns a minimal shape for fast UI rendering and Redis caching.
    """

    team_name: str
    points: Decimal
    rank: int | None = None


class PowerRankingEntry(BaseModel):
    """GET /leagues/{id}/power-rankings — one row per team, most recent window."""

    fantasy_team_id: uuid.UUID
    team_name: str
    rank: int
    points: float
    rank_delta: int | None = None
    streak: int
    manager_of_the_week: bool


# ═══════════════════════════════════════════════════════════════════════════════
# League status update
# ═══════════════════════════════════════════════════════════════════════════════


class StatusUpdate(BaseModel):
    """PATCH /leagues/{id}/status — transition league lifecycle state.

    Why a dedicated schema instead of accepting a raw string?
    ─────────────────────────────────────────────────────────
    1. OpenAPI docs render the enum values so the frontend knows
       exactly which strings are valid — no guessing.
    2. Pydantic validates the value BEFORE the service layer sees it,
       giving an automatic 422 for typos ("actve" → 422 not a silent bug).
    3. One-field schemas still belong in schemas.py, not inline in the
       router — inline Depends(Body(...)) schemas don't appear in the
       generated OpenAPI spec, so Swagger UI / Redoc can't render them.
    """
    new_status: LeagueStatus


class MidseasonJoinUpdate(BaseModel):
    """PATCH /leagues/{id}/midseason-join — toggle active budget joining."""

    allow_midseason_join: bool


class RenewLeagueRequest(BaseModel):
    """POST /leagues/{id}/renew — start the next season of a completed league.

    target_season_id is optional — if omitted, the service auto-selects the
    earliest active Season (for the league's sport) starting after the
    current league's end_date.

    dynasty=True carries every team's active roster over into the new
    season instead of starting fresh — see renew_league() for details.
    """

    target_season_id: uuid.UUID | None = None
    dynasty: bool = False


class SeasonHistoryItem(BaseModel):
    """One entry in a league's season-rollover lineage."""

    id: uuid.UUID
    season_number: int
    status: LeagueStatus
    name: str
    start_date: date | None = None
    end_date: date | None = None

    model_config = ConfigDict(from_attributes=True)


class LeagueSettingsUpdate(BaseModel):
    """PATCH /leagues/{id} — update a league's editable settings.

    Partial update: every field is optional and only the provided ones are
    applied. Currently limited to the settings that map cleanly to the model —
    name and public/private visibility. (Team size and draft type are fixed at
    creation and intentionally not editable here.)
    """

    name: str | None = Field(default=None, min_length=1, max_length=100)
    is_public: bool | None = None

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("League name cannot be empty")
        return stripped


# ═══════════════════════════════════════════════════════════════════════════════
# Join league
# ═══════════════════════════════════════════════════════════════════════════════


class JoinLeagueRequest(BaseModel):
    """POST /leagues/join — join a league by invite code."""
    invite_code: str = Field(min_length=1, max_length=32)


# ═══════════════════════════════════════════════════════════════════════════════
# Draft pick create
# ═══════════════════════════════════════════════════════════════════════════════


class DraftPickCreate(BaseModel):
    """POST /leagues/{id}/draft/pick — select a player during the draft.

    Why a request body schema instead of a query param?
    ───────────────────────────────────────────────────
    1. POST semantics: the body IS the resource being created.
       Query params are filters/modifiers, not payloads.
    2. UUIDs in query strings are ugly, easy to mis-copy, and get
       logged in access logs (security-neutral here, but bad habit).
    3. OpenAPI tools (Swagger UI) render body schemas with a nice
       form; query params get a plain text box.
    """
    player_id: uuid.UUID


class DraftTurnResponse(BaseModel):
    league_id: uuid.UUID
    current_turn_user_id: uuid.UUID | None = None
    next_pick_number: int
    round_number: int
    is_draft_complete: bool


# ═══════════════════════════════════════════════════════════════════════════════
# Transfer
# ═══════════════════════════════════════════════════════════════════════════════


class TransferCreate(BaseModel):
    """POST /leagues/{id}/transfers — swap one player out, one in.

    pay_shortfall_with_points: if the swap would take current_budget
    negative, False (default) gets a structured 409 back (shortfall,
    points_cost, available_points) instead of the transfer being applied.
    Retry with this set to True to actually charge the shortfall against
    league points rather than being blocked.
    """
    player_out_id: uuid.UUID
    player_in_id: uuid.UUID
    pay_shortfall_with_points: bool = False


class TransferResponse(BaseModel):
    """What gets returned when a transfer completes or is listed.

    Note what's exposed:
      ✅ id, player_out (nested), player_in (nested), fantasy_team (nested),
         transfer_window (nested), cost_at_transfer, points_charged, created_at
      ❌ fantasy_team_id, transfer_window_id, player_out_id, player_in_id (raw FKs)

    points_charged is populated from PointsPenalty when this transfer covered
    a budget overage with league points (None otherwise) — set explicitly by
    the router, not an ORM attribute on Transfer itself.
    """
    id: uuid.UUID
    fantasy_team: FantasyTeamResponse
    transfer_window: TransferWindowBrief
    player_out: PlayerBrief
    player_in: PlayerBrief
    cost_at_transfer: Decimal
    points_charged: Decimal | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserTransferHistoryLeagueBrief(BaseModel):
    """Minimal league metadata for grouped user transfer history."""
    id: uuid.UUID
    name: str
    sports: list[LeagueSportResponse] = []

    model_config = ConfigDict(from_attributes=True)


class UserTransferHistoryLeagueResponse(BaseModel):
    """Transfers made by the authenticated user within one league."""
    league: UserTransferHistoryLeagueBrief
    transfers: list[TransferResponse]

    model_config = ConfigDict(from_attributes=True)


# ═══════════════════════════════════════════════════════════════════════════════
# Build initial team (budget-mode leagues)
# ═══════════════════════════════════════════════════════════════════════════════


class TeamBuildRequest(BaseModel):
    """POST /leagues/{id}/teams/build — build initial team for budget-mode league.
    
    Used when league is in SETUP and draft_mode=False.
    Users pick their starting squad within budget constraints.
    """
    team_name: str = Field(min_length=2, max_length=100)
    player_ids: list[uuid.UUID] = Field(min_length=1, max_length=30)
    
    @field_validator("team_name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Team name cannot be blank")
        return v.strip()
    
    @field_validator("player_ids")
    @classmethod
    def no_duplicate_players(cls, v: list[uuid.UUID]) -> list[uuid.UUID]:
        if len(v) != len(set(v)):
            raise ValueError("Duplicate players not allowed")
        return v


class AutoPickRequest(BaseModel):
    """POST /leagues/{id}/auto-pick — generate auto-picked squad suggestions."""

    locked_player_ids: list[uuid.UUID] = Field(default_factory=list, alias="lockedPlayerIds")

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("locked_player_ids")
    @classmethod
    def no_duplicate_locked_players(cls, value: list[uuid.UUID]) -> list[uuid.UUID]:
        if len(value) != len(set(value)):
            raise ValueError("Duplicate locked players not allowed")
        return value


class AutoPickPlayerResponse(BaseModel):
    id: uuid.UUID
    name: str
    sport_type: str
    position: str
    cost: Decimal


class AutoPickSquadResponse(BaseModel):
    players: list[AutoPickPlayerResponse]
    total_cost: Decimal = Field(alias="totalCost")
    budget_remaining: Decimal = Field(alias="budgetRemaining")

    model_config = ConfigDict(populate_by_name=True)


class BudgetDiscardResponse(BaseModel):
    message: str
    refund: Decimal
    penalty_applied: Decimal
    remaining_budget: Decimal


# ═══════════════════════════════════════════════════════════════════════════════
# Metadata (Seasons, Sports)
# ═══════════════════════════════════════════════════════════════════════════════




class SeasonResponse(BaseModel):
    """What gets returned for public season listings."""
    id: uuid.UUID
    sport_id: uuid.UUID
    name: str
    start_date: datetime | date
    end_date: datetime | date
    is_active: bool
    # Date-derived (Season.is_current property, not a DB column) — lets
    # clients auto-select "the season running right now" for a sport instead
    # of guessing among a sport's active-but-not-necessarily-current seasons.
    is_current: bool
    # Same date-derived source as is_current, as a richer 3-way view for
    # admin display (Season.status property).
    status: Literal["upcoming", "running", "finished"]

    model_config = ConfigDict(from_attributes=True)


class TransferWindowResponse(BaseModel):
    """What gets returned for public transfer window listings."""
    id: uuid.UUID
    season_id: uuid.UUID
    number: int
    total_number: int
    start_at: datetime
    end_at: datetime
    # Transfers close at transfer_deadline_at (2h before the window ends) and
    # can be force-locked via transfers_locked. The transfers UI gates the
    # stage-in/out controls on these, so they MUST be serialized — without them
    # the client reads `undefined` and treats transfers as permanently closed.
    transfer_deadline_at: datetime
    transfers_locked: bool
    lineup_deadline_at: datetime
    lineup_locked: bool

    model_config = ConfigDict(from_attributes=True)


class SportResponse(BaseModel):
    """What gets returned for public sport listings."""
    id: uuid.UUID
    name: str
    display_name: str
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


# ═══════════════════════════════════════════════════════════════════════════════
# Lineup
# ═══════════════════════════════════════════════════════════════════════════════


class LeaderboardEntryResponse(BaseModel):
    """A single team's standing in a league's leaderboard."""
    team_id: uuid.UUID
    team_name: str
    owner_name: str
    points: Decimal
    rank: int | None
    
    model_config = ConfigDict(from_attributes=True)


class LeaderboardResponse(BaseModel):
    """The full leaderboard for a league/gameweek."""
    league_id: uuid.UUID
    transfer_window_id: uuid.UUID | None
    entries: list[LeaderboardEntryResponse]
    
    model_config = ConfigDict(from_attributes=True)


class GameweekPointsResponse(BaseModel):
    """One gameweek's score for a team — a single point on the dashboard's
    per-gameweek history (sourced from team_weekly_scores)."""

    gameweek: int  # TransferWindow.number
    transfer_window_id: uuid.UUID
    points: Decimal
    rank: int | None = None

    model_config = ConfigDict(from_attributes=True)


class LeagueDashboardStatsResponse(BaseModel):
    """GET /leagues/{id}/dashboard/stats — league-scoped dashboard KPIs."""

    league_id: uuid.UUID
    team_id: uuid.UUID
    rank: int | None = None
    gameweek_points: Decimal | None = None
    total_points: Decimal = Decimal("0")
    budget: Decimal
    # Per-gameweek breakdown (ordered by gameweek number). total_points is the
    # sum of these rows' points; gameweek_points is the active window's row.
    gameweek_breakdown: list[GameweekPointsResponse] = []

    model_config = ConfigDict(from_attributes=True)


class LineupEntryResponse(BaseModel):
    """A single player inside a team's weekly lineup."""
    player_id: uuid.UUID
    is_captain: bool
    is_vice_captain: bool
    is_starter: bool = True
    bench_order: int | None = None
    # True when this row was written by the auto-carry-forward job because
    # the user never submitted a lineup for this window (see
    # app/services/lineup_carry_forward_service.py), not a manual save.
    is_carried_forward: bool = False
    player: PlayerBrief
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LineupResponse(BaseModel):
    """Result of GET /leagues/{id}/my-team/lineup."""
    fantasy_team_id: uuid.UUID
    team_name: str
    transfer_window_id: uuid.UUID
    starting_lineup: list[LineupEntryResponse]
    bench: list[LineupEntryResponse] = Field(default_factory=list)
    squad_players: list[TeamPlayerResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class GameweekPlayerRecap(BaseModel):
    """One player's contribution in a scored gameweek."""
    player: PlayerBrief
    is_starter: bool
    is_captain: bool
    is_vice_captain: bool
    bench_order: int | None = None
    minutes_played: int
    points: Decimal            # raw fantasy points the player earned this window
    captain_bonus: Decimal     # extra points from the captain / vice-captain rule
    counted: bool              # whether the player was in the effective scoring XI
    status: str                # played | did_not_play | subbed_in | subbed_out | benched
    contributed_points: Decimal  # what this player actually added to the team total

    model_config = ConfigDict(from_attributes=True)


class GameweekRecapResponse(BaseModel):
    """GET /leagues/{id}/my-team/gameweek-recap — the user's team for a scored
    gameweek with a per-player points breakdown (incl. auto-substitutions)."""
    fantasy_team_id: uuid.UUID
    team_name: str
    transfer_window_id: uuid.UUID
    gameweek_number: int
    total_points: Decimal
    base_points: Decimal
    captain_vice_bonus: Decimal
    rank_in_league: int | None = None
    players: list[GameweekPlayerRecap] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class LineupUpdateRequest(BaseModel):
    """PATCH /leagues/{id}/my-team/lineup — set starters/captains for the week."""
    starting_lineup_player_ids: list[uuid.UUID] = Field(
        min_length=1,
        max_length=15,
        validation_alias=AliasChoices("starting_lineup_player_ids", "player_ids"),
    )
    # Optional ordered bench (index 0 = first auto-sub to come on). When omitted,
    # the bench is derived as (squad − starters) in squad order. Players listed
    # here take priority; any remaining squad members are appended after them.
    bench_player_ids: list[uuid.UUID] = Field(
        default_factory=list,
        max_length=15,
    )
    captain_id: uuid.UUID
    vice_captain_id: uuid.UUID

    @field_validator("starting_lineup_player_ids", "bench_player_ids")
    @classmethod
    def no_duplicates(cls, v: list[uuid.UUID]) -> list[uuid.UUID]:
        if len(v) != len(set(v)):
            raise ValueError("Duplicate players in lineup")
        return v

    @model_validator(mode="after")
    def starters_and_bench_disjoint(self) -> "LineupUpdateRequest":
        overlap = set(self.starting_lineup_player_ids) & set(self.bench_player_ids)
        if overlap:
            raise ValueError("A player cannot be both a starter and on the bench")
        return self


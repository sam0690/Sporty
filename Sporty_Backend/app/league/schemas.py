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

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator

from app.league.models import LeagueStatus
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
    budget_per_team: Decimal = Field(default=Decimal("100.00"), gt=0, max_digits=12, decimal_places=2)
    draft_mode: bool = Field(default=False)
    allow_midseason_join: bool = Field(default=False)
    transfers_per_window: int = Field(default=4, ge=0, le=10)
    transfer_day: int = Field(default=1, ge=1, le=7)
    start_date: date | None = None
    end_date: date | None = None

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
    draft_mode: bool
    allow_midseason_join: bool
    transfers_per_window: int
    transfer_day: int
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
    """Minimal roster entry for a team owner view."""

    player: PlayerBrief
    joined_at: datetime = Field(alias="created_at")

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
    """POST /leagues/{id}/transfers — swap one player out, one in."""
    player_out_id: uuid.UUID
    player_in_id: uuid.UUID


class TransferResponse(BaseModel):
    """What gets returned when a transfer completes or is listed.

    Note what's exposed:
      ✅ id, player_out (nested), player_in (nested), fantasy_team (nested),
         transfer_window (nested), cost_at_transfer, created_at
      ❌ fantasy_team_id, transfer_window_id, player_out_id, player_in_id (raw FKs)
      ❌ points_deducted (no longer used in budget-mode)
    """
    id: uuid.UUID
    fantasy_team: FantasyTeamResponse
    transfer_window: TransferWindowBrief
    player_out: PlayerBrief
    player_in: PlayerBrief
    cost_at_transfer: Decimal
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

    model_config = ConfigDict(from_attributes=True)


class TransferWindowResponse(BaseModel):
    """What gets returned for public transfer window listings."""
    id: uuid.UUID
    season_id: uuid.UUID
    number: int
    total_number: int
    start_at: datetime
    end_at: datetime
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


class LeagueDashboardStatsResponse(BaseModel):
    """GET /leagues/{id}/dashboard/stats — league-scoped dashboard KPIs."""

    league_id: uuid.UUID
    team_id: uuid.UUID
    rank: int | None = None
    gameweek_points: Decimal | None = None
    total_points: Decimal = Decimal("0")
    budget: Decimal

    model_config = ConfigDict(from_attributes=True)


class LineupEntryResponse(BaseModel):
    """A single player inside a team's weekly lineup."""
    player_id: uuid.UUID
    is_captain: bool
    is_vice_captain: bool
    player: PlayerBrief
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LineupResponse(BaseModel):
    """Result of GET /leagues/{id}/my-team/lineup."""
    fantasy_team_id: uuid.UUID
    team_name: str
    transfer_window_id: uuid.UUID
    starting_lineup: list[LineupEntryResponse]
    squad_players: list[TeamPlayerResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class LineupUpdateRequest(BaseModel):
    """PATCH /leagues/{id}/my-team/lineup — set starters/captains for the week."""
    starting_lineup_player_ids: list[uuid.UUID] = Field(
        min_length=1,
        max_length=15,
        validation_alias=AliasChoices("starting_lineup_player_ids", "player_ids"),
    )
    captain_id: uuid.UUID
    vice_captain_id: uuid.UUID

    @field_validator("starting_lineup_player_ids")
    @classmethod
    def no_duplicates(cls, v: list[uuid.UUID]) -> list[uuid.UUID]:
        if len(v) != len(set(v)):
            raise ValueError("Duplicate players in lineup")
        return v


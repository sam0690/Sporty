"""
Player module Pydantic schemas.

Rules applied:
  1. Response schemas are security boundaries — no internal IDs where names
     suffice, no cascade-sensitive FKs, no admin-only fields.
  2. Nested objects over raw UUIDs in responses.
  3. model_config = ConfigDict(from_attributes=True) on every response schema.
  4. Validators on create/filter schemas — lengths, ranges, formats.
  5. Response schema ≠ ORM model.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    Field,
    computed_field,
    field_validator,
)

from app.schemas.common import TransferWindowBrief, PlayerBrief, SportBrief  # noqa: F401 — re-export
from app.services.sync.nationalities import flag_url


# ═══════════════════════════════════════════════════════════════════════════════
# PlayerResponse
# ═══════════════════════════════════════════════════════════════════════════════


class PlayerResponse(BaseModel):
    """Public player data — what any user sees.

    Note what's exposed vs hidden:
      ✅ id, name, position, real_team, cost, is_available, sport (nested)
      ❌ sport_id (raw FK) — replaced by nested sport object
      ❌ updated_at — internal bookkeeping
      ❌ gameweek_stats relationship — separate endpoint
    """
    id: uuid.UUID
    name: str
    position: str
    # TODO: switch to player.real_team_fk.name after FK migration
    real_team: str
    photo_url: str | None = None
    real_team_logo_url: str | None = None
    cost: Decimal
    is_available: bool
    created_at: datetime

    # Biographical enrichment — all optional, not every player has every
    # field populated. nationality/date_of_birth come from football-data.org
    # (scripts/backfill_player_bio.py); height/weight/jersey_number are only
    # available on paid tiers of our providers, so they are widely null.
    nationality: str | None = None
    date_of_birth: date | None = None
    height: str | None = None
    weight: str | None = None
    jersey_number: int | None = None
    bio: str | None = None
    wage: str | None = None
    signing_fee: str | None = None
    date_signed: date | None = None
    agent: str | None = None
    social_links: dict[str, str] | None = None

    # Recency-weighted average of the last 3 gameweeks' fantasy_points — a
    # smarter historical statistic, NOT a trained prediction (no opponent
    # adjustment, no injury/availability signal). None if the player has no
    # stats in that window yet. See app/services/scoring/projection.py.
    projected_points: Decimal | None = None

    # Nested sport instead of raw sport_id
    sport: SportBrief

    model_config = ConfigDict(from_attributes=True)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def flag_url(self) -> str | None:
        """Flag for `nationality`, served from our own R2 bucket.

        Derived rather than stored: ~1780 players share ~96 nationalities, so
        a column would repeat the same handful of URLs. Returns None when the
        nationality is unknown or unmapped — the UI must handle a missing flag
        regardless, since not every player has a nationality at all.
        """
        return flag_url(self.nationality)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def age(self) -> int | None:
        """Age in whole years, so clients don't each re-derive it from the DOB."""
        if self.date_of_birth is None:
            return None
        today = date.today()
        had_birthday = (today.month, today.day) >= (
            self.date_of_birth.month,
            self.date_of_birth.day,
        )
        return today.year - self.date_of_birth.year - (0 if had_birthday else 1)


# ═══════════════════════════════════════════════════════════════════════════════
# PlayerListResponse (paginated)
# ═══════════════════════════════════════════════════════════════════════════════


class PlayerListResponse(BaseModel):
    """Paginated list of players.

    Why a wrapper instead of returning a bare list?
      - Bare list: no metadata. Client doesn't know total count, page
        number, or whether more results exist.
      - Wrapper: total + items lets the frontend build pagination controls
        ("Showing 1-20 of 347 players").
    """
    items: list[PlayerResponse]
    total: int
    page: int
    page_size: int
    has_next: bool


# ═══════════════════════════════════════════════════════════════════════════════
# PlayerFilter (query params for GET /players)
# ═══════════════════════════════════════════════════════════════════════════════


class PlayerFilter(BaseModel):
    """Query parameters for filtering the player list.

    All fields optional — no filter = return all (paginated).
    Used with Depends() in the router to parse query params.

    league_id:
      The most important use case for GET /players is:
      "Show me available players I can transfer IN to my team."

      That scopes the pool to the league's sports + competitions, and in
      DRAFT leagues also EXCLUDES players already rostered there (draft
      ownership is exclusive; budget leagues are FPL-style, where every
      manager may own the same player). Without league_id, the service
      layer can't perform that exclusion efficiently — it would have to
      fetch ALL owned players across all leagues and filter in Python.

      With league_id, a draft league's query does:
        subq = select(TeamPlayer.player_id).where(
            TeamPlayer.fantasy_team_id.in_(
                select(FantasyTeam.id).where(FantasyTeam.league_id == league_id)
            ),
            TeamPlayer.released_window_id.is_(None),  # still active
        )
        query = query.where(Player.id.not_in(subq))

      This is optional — omitting league_id returns all players
      (useful for admin views or general browsing).
    """
    league_id: uuid.UUID | None = Field(
        default=None,
        description="Scope the pool to this league (draft leagues also hide "
                    "players already rostered in it)",
    )
    sport_name: str | None = Field(
        default=None,
        max_length=50,
        description="Filter by sport slug, e.g. 'football'",
    )
    position: str | None = Field(
        default=None,
        max_length=20,
        description="Filter by position code, e.g. 'FWD'",
    )
    # TODO: switch to player.real_team_fk.name after FK migration
    real_team: str | None = Field(
        default=None,
        max_length=100,
        description="Filter by real-world team name",
    )
    is_available: bool | None = Field(
        default=None,
        description="Filter by availability status",
    )
    include_unavailable: bool = Field(
        default=False,
        description=(
            "Include players flagged is_available=False (transferred out of the "
            "supported leagues, injured, suspended). Off by default so they cannot "
            "be browsed and then rejected at buy time; admin views turn it on."
        ),
    )
    minCost: Decimal | None = Field(
        default=None,
        ge=0,
        validation_alias=AliasChoices("minCost", "min_cost"),
        description="Minimum player cost",
    )
    maxCost: Decimal | None = Field(
        default=None,
        ge=0,
        validation_alias=AliasChoices("maxCost", "max_cost"),
        description="Maximum player cost",
    )
    name: str | None = Field(
        default=None,
        max_length=150,
        validation_alias=AliasChoices("name", "search"),
        description="Search player name (case-insensitive partial match)",
    )

    # Pagination
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)

    @field_validator("position")
    @classmethod
    def position_uppercase(cls, v: str | None) -> str | None:
        return v.strip().upper() if v else v

    @field_validator("sport_name")
    @classmethod
    def sport_name_lowercase(cls, v: str | None) -> str | None:
        return v.strip().lower() if v else v

    @field_validator("name")
    @classmethod
    def name_trimmed(cls, v: str | None) -> str | None:
        return v.strip() if v else v

    @field_validator("maxCost")
    @classmethod
    def max_gte_min(cls, v: Decimal | None, info) -> Decimal | None:
        min_cost = info.data.get("minCost")
        if v is not None and min_cost is not None and v < min_cost:
            raise ValueError("maxCost must be >= minCost")
        return v

    model_config = ConfigDict(populate_by_name=True)


# ═══════════════════════════════════════════════════════════════════════════════
# FootballStatResponse
# ═══════════════════════════════════════════════════════════════════════════════


class FootballStatResponse(BaseModel):
    """Football-specific stats for a single gameweek.

    All fields are non-nullable integers (0 = didn't happen,
    distinct from NULL = didn't play, which is handled at the
    base stat level via minutes_played).
    """
    goals: int
    assists: int
    clean_sheets: int
    yellow_cards: int
    red_cards: int
    own_goals: int
    penalties_saved: int
    penalties_missed: int
    saves: int
    goals_conceded: int
    bonus: int
    # Advanced metrics (nullable-safe defaults keep older rows valid).
    tackles: int = 0
    interceptions: int = 0
    blocks: int = 0
    clearances: int = 0
    key_passes: int = 0
    shots_on_target: int = 0
    dribbles_won: int = 0
    duels_won: int = 0
    rating: Decimal | None = None

    model_config = ConfigDict(from_attributes=True)


# ═══════════════════════════════════════════════════════════════════════════════
# CricketStatResponse
# ═══════════════════════════════════════════════════════════════════════════════


class CricketStatResponse(BaseModel):
    """Cricket-specific stats for a single gameweek.

    All fields are nullable — NULL means "did not bat/bowl/field".
    This is semantically different from 0 (see player/models.py Q3):
      runs_scored=0   → batted and scored zero
      runs_scored=None → did not bat
    """
    runs_scored: int | None = None
    balls_faced: int | None = None
    wickets_taken: int | None = None
    maidens: int | None = None
    economy_rate: Decimal | None = None
    catches: int | None = None
    run_outs: int | None = None

    model_config = ConfigDict(from_attributes=True)


# ═══════════════════════════════════════════════════════════════════════════════
# PlayerGameweekStatResponse
# ═══════════════════════════════════════════════════════════════════════════════


class PlayerGameweekStatResponse(BaseModel):
    """Base transfer window stat + optional sport-specific child.

    The response includes at most ONE of football_stat / cricket_stat,
    depending on the player's sport. The other will be None.

    Why nest the child instead of flattening all fields?
      - Flattening mixes football columns (goals, assists) with cricket
        columns (runs_scored, wickets_taken) in the same JSON object.
        The frontend would need sport-aware logic to ignore irrelevant
        fields. With nesting, the frontend checks:
          if (stat.football_stat) { render football card }
          else if (stat.cricket_stat) { render cricket card }

    Note what's exposed vs hidden:
      ✅ player (brief), transfer_window (brief), minutes, points, sport stats
      ❌ id, player_id, transfer_window_id (raw FKs) — replaced by nested objects
      ❌ created_at — internal bookkeeping
    """
    player: PlayerBrief
    transfer_window: TransferWindowBrief
    minutes_played: int
    fantasy_points: Decimal

    # Explainable per-window points breakdown (list of {action, count,
    # points_each, subtotal, position}) written by the scoring engine. Generic
    # so the UI renders it without hardcoded categories. None for legacy rows.
    breakdown: list[dict] | None = None

    # At most one of these will be non-None
    football_stat: FootballStatResponse | None = None
    cricket_stat: CricketStatResponse | None = None

    model_config = ConfigDict(from_attributes=True)


class PlayerPriceHistoryItem(BaseModel):
    """Immutable player price movement record."""

    old_cost: Decimal
    new_cost: Decimal
    delta: Decimal
    weighted_points: Decimal | None = None
    algorithm_version: str
    created_at: datetime
    transfer_window: TransferWindowBrief | None = None

    model_config = ConfigDict(from_attributes=True)


class PlayerPriceHistoryResponse(BaseModel):
    """Recent player price history for market charts and audit views."""

    items: list[PlayerPriceHistoryItem]


class PlayerRecentStatsResponse(BaseModel):
    """Recent gameweek-by-gameweek performance for a player's detail view."""

    items: list[PlayerGameweekStatResponse]

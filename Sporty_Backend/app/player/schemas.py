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
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.common import TransferWindowBrief, PlayerBrief, SportBrief  # noqa: F401 — re-export


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
    real_team: str
    cost: Decimal
    is_available: bool
    created_at: datetime

    # Nested sport instead of raw sport_id
    sport: SportBrief

    model_config = ConfigDict(from_attributes=True)


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

      That query must EXCLUDE players already owned by any team in
      this league. Without league_id, the service layer can't perform
      that exclusion efficiently — it would have to fetch ALL owned
      players across all leagues and filter in Python.

      With league_id, the service does:
        subq = select(TeamPlayer.player_id).where(
            TeamPlayer.fantasy_team_id.in_(
                select(FantasyTeam.id).where(FantasyTeam.league_id == league_id)
            ),
            TeamPlayer.released_gameweek_id.is_(None),  # still active
        )
        query = query.where(Player.id.not_in(subq))

      This is optional — omitting league_id returns all players
      (useful for admin views or general browsing).
    """
    league_id: uuid.UUID | None = Field(
        default=None,
        description="Exclude players already owned in this league"
    )
    sport_name: str | None = Field(
        default=None, max_length=50,
        description="Filter by sport slug, e.g. 'football'"
    )
    position: str | None = Field(
        default=None, max_length=20,
        description="Filter by position code, e.g. 'FWD'"
    )
    real_team: str | None = Field(
        default=None, max_length=100,
        description="Filter by real-world team name"
    )
    is_available: bool | None = Field(
        default=None,
        description="Filter by availability status"
    )
    min_cost: Decimal | None = Field(
        default=None, ge=0,
        description="Minimum player cost"
    )
    max_cost: Decimal | None = Field(
        default=None, ge=0,
        description="Maximum player cost"
    )
    search: str | None = Field(
        default=None, max_length=150,
        description="Search player name (case-insensitive LIKE)"
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

    @field_validator("max_cost")
    @classmethod
    def max_gte_min(cls, v: Decimal | None, info) -> Decimal | None:
        min_cost = info.data.get("min_cost")
        if v is not None and min_cost is not None and v < min_cost:
            raise ValueError("max_cost must be >= min_cost")
        return v


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

    # At most one of these will be non-None
    football_stat: FootballStatResponse | None = None
    cricket_stat: CricketStatResponse | None = None

    model_config = ConfigDict(from_attributes=True)

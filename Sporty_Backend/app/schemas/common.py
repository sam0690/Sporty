"""
Shared "Brief" schemas — reusable nested fragments for response schemas.

Why this module exists:
  Multiple domain modules need the same Brief schemas in their responses.
  If league/schemas.py defines SportBrief and player/schemas.py also needs
  it, you get one of two bad outcomes:
    1. Duplicate definitions — diverge over time.
    2. Cross-module imports — player imports from league, league imports
       PlayerBrief from player → circular import.

  Solution: extract all Brief schemas into a shared module that everyone
  imports from. No domain module imports Brief schemas from another domain
  module. The dependency graph is a star, not a cycle:

      app/schemas/common.py
        ↑       ↑       ↑
    league/  player/  scoring/
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class SportBrief(BaseModel):
    """Minimal sport info embedded inside other responses."""
    name: str
    display_name: str

    model_config = ConfigDict(from_attributes=True)


class SeasonBrief(BaseModel):
    """Minimal season info embedded inside league responses."""
    name: str
    start_date: date
    end_date: date

    model_config = ConfigDict(from_attributes=True)


class UserBrief(BaseModel):
    """Public-safe user info — never expose email or auth internals."""
    id: uuid.UUID
    username: str
    avatar_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


class PlayerBrief(BaseModel):
    """Minimal player info embedded in DraftPick, TeamPlayer responses.

    Includes sport (nested) so you always know which sport context
    a player belongs to without a separate lookup.
    """
    id: uuid.UUID
    name: str
    position: str
    real_team: str
    cost: Decimal
    sport: SportBrief

    model_config = ConfigDict(from_attributes=True)


class TransferWindowBrief(BaseModel):
    """Minimal transfer window info — number is all you usually need in responses."""
    id: uuid.UUID
    number: int
    start_at: datetime
    end_at: datetime

    model_config = ConfigDict(from_attributes=True)

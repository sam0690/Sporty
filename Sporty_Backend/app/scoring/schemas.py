"""
Scoring module Pydantic schemas.

Rules applied:
  1. Response schemas are security boundaries — no internal IDs where names
     suffice, no cascade-sensitive FKs, no admin-only fields.
  2. Nested objects over raw UUIDs in responses.
  3. model_config = ConfigDict(from_attributes=True) on every response schema.
  4. Validators on create schemas — lengths, ranges, formats.
  5. Response schema ≠ ORM model.
"""

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.common import SportBrief


# ═══════════════════════════════════════════════════════════════════════════════
# ScoringRuleResponse (default rules — admin-managed)
# ═══════════════════════════════════════════════════════════════════════════════


class ScoringRuleResponse(BaseModel):
    """Default scoring rule display — what any user sees.

    Note what's exposed vs hidden:
      ✅ id, action, points, description, sport (nested), timestamps
      ❌ sport_id (raw FK) — replaced by nested sport object
    """
    id: uuid.UUID
    action: str
    points: Decimal
    description: str
    sport: SportBrief
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ═══════════════════════════════════════════════════════════════════════════════
# ScoringOverrideCreate (league admin sets custom point value)
# ═══════════════════════════════════════════════════════════════════════════════


class ScoringOverrideCreate(BaseModel):
    """POST /leagues/{id}/scoring-overrides — league admin sets override.

    The league_id comes from the URL path, so it's not in the body.
    sport_id + action identify WHICH default rule is being overridden.
    points is the new value for this league.

    No description field — overrides inherit the description from the
    default rule they override (see scoring/models.py Q1 answer).
    """
    sport_id: uuid.UUID
    action: str = Field(min_length=1, max_length=50)
    points: Decimal = Field(max_digits=6, decimal_places=2)

    @field_validator("action")
    @classmethod
    def action_lowercase_snake(cls, v: str) -> str:
        """Normalize action to lowercase with underscores.

        Prevents duplicates like "Goal_Fwd" vs "goal_fwd".
        """
        stripped = v.strip().lower()
        if not stripped:
            raise ValueError("Action cannot be blank")
        if not all(c.isalnum() or c == "_" for c in stripped):
            raise ValueError("Action must be alphanumeric with underscores only")
        return stripped


# ═══════════════════════════════════════════════════════════════════════════════
# ScoringOverrideResponse
# ═══════════════════════════════════════════════════════════════════════════════


class ScoringOverrideResponse(BaseModel):
    """What gets returned when reading a scoring override.

    Note what's exposed vs hidden:
      ✅ id, action, points, sport (nested), created_at
      ❌ league_id — caller already knows which league they queried
      ❌ sport_id (raw FK) — replaced by nested sport object
    """
    id: uuid.UUID
    action: str
    points: Decimal
    sport: SportBrief
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

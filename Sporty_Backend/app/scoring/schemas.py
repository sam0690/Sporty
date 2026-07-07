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

from pydantic import BaseModel, ConfigDict

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

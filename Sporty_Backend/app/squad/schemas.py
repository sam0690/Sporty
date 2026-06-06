"""
Squad validation schemas.

No Pydantic request/response schemas are needed here yet — the squad
validation functions accept SQLAlchemy model instances directly.
This module is reserved for typed input/output contracts if the
validation layer ever gains an external API surface (e.g. a bulk
validation endpoint or a validation SDK).
"""
from __future__ import annotations

from typing import NamedTuple


class PositionCount(NamedTuple):
    """(sport_id, normalised_position) → player count in the candidate squad."""
    sport_id: object   # uuid.UUID at runtime
    position: str
    count: int

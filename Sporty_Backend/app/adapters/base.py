from __future__ import annotations

from abc import ABC, abstractmethod

from app.models.schemas.events import NormalizedEvent, RawEvent


class ISportAdapter(ABC):
    sport: str

    @abstractmethod
    async def poll(self, match_id: str) -> list[RawEvent]:
        """Poll provider and return raw events for a live match."""

    @abstractmethod
    def normalize(self, raw: RawEvent) -> NormalizedEvent:
        """Normalize provider-specific event payload to canonical format."""

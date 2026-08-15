"""Fuzzy person-name matching against an external football feed.

Needed because our player pool carries API-Football ids while FPL and
football-data.org each use their own, so a player can only be recognised by
name. Every rule here exists because its absence produced a wrong match
against production data:

  * Punctuation folds to a SPACE, not to nothing — 27 FPL players carry a
    hyphen or apostrophe (Calvert-Lewin, O'Riley) that our pool spells with a
    space ("Callum Hudson Odoi"). Deleting the separator makes the two
    spellings unmatchable.
  * HTML entities are unescaped — the pool contains literal `J. O&apos;Brien`.
  * A unique family name is NOT sufficient. The pool holds four players
    surnamed Gomes (Rodrigo, Angel, Toti, João) where the feed lists one;
    matching on family name alone collapsed all four onto it.
  * Given names are prefix-matched, because our names are mixed-format:
    "E. Balcombe" must reach the feed's "Elliot Balcombe".
"""
from __future__ import annotations

import html
import re
import unicodedata
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Iterable


def normalize(value: str | None) -> str:
    """Fold a name to bare lowercase ASCII words."""
    text = html.unescape(value or "")
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return re.sub(r"[^a-z]+", " ", text.lower()).strip()


def surname(value: str | None) -> str:
    """The last word of a normalized name, or "" if there isn't one."""
    parts = normalize(value).split()
    return parts[-1] if parts else ""


@dataclass
class Candidate:
    """One person on the external side, pre-normalized for matching."""

    given: str
    family: str
    short: str
    club: str = ""
    payload: Any = None

    @classmethod
    def build(
        cls,
        given: str | None,
        family: str | None,
        short: str | None = None,
        club: str | None = None,
        payload: Any = None,
    ) -> "Candidate":
        return cls(
            given=normalize(given),
            family=normalize(family),
            short=normalize(short or family),
            club=normalize(club),
            payload=payload,
        )

    @classmethod
    def from_full_name(
        cls, full_name: str, club: str | None = None, payload: Any = None
    ) -> "Candidate":
        """For feeds that expose one undifferentiated name ("Unai Simón")."""
        parts = normalize(full_name).split()
        return cls(
            given=" ".join(parts[:-1]),
            family=parts[-1] if parts else "",
            short=" ".join(parts),
            club=normalize(club),
            payload=payload,
        )

    def keys(self) -> set[str]:
        """Family-name keys this candidate should be reachable under."""
        return {k for k in (self.family.split()[-1:] + self.short.split()[-1:]) if k}


@dataclass
class NameIndex:
    """Family-name index over candidates, with given-name disambiguation."""

    _by_family: dict[str, list[Candidate]] = field(default_factory=lambda: defaultdict(list))

    @classmethod
    def build(cls, candidates: Iterable[Candidate]) -> "NameIndex":
        index = cls(defaultdict(list))
        for candidate in candidates:
            for key in candidate.keys():
                index._by_family[key].append(candidate)
        return index

    def match(self, name: str, club: str | None = None) -> Any | None:
        """Resolve one of our player names to a candidate payload, or None.

        `club` is only a tie-breaker between people who already agree on both
        family and given name — it must never be the reason a match is made,
        or a genuine transfer would look like a miss.
        """
        parts = normalize(name).split()
        if not parts:
            return None

        candidates = self._by_family.get(parts[-1], [])
        if not candidates:
            return None

        if len(parts) == 1:
            # No given name to corroborate with, so demand the feed's own
            # short name match exactly ("Denner", "Beto").
            exact = [c for c in candidates if c.short == parts[0]]
            return exact[0].payload if len(exact) == 1 else None

        given = parts[0]
        agreeing = [c for c in candidates if _given_agrees(given, c.given)]
        if len(agreeing) == 1:
            return agreeing[0].payload
        if not agreeing:
            return None

        normalized_club = normalize(club)
        same_club = [c for c in agreeing if c.club and c.club == normalized_club]
        return same_club[0].payload if len(same_club) == 1 else None


def _given_agrees(ours: str, theirs: str) -> bool:
    """Prefix agreement, so a bare initial ("E.") still matches "Elliot"."""
    if not ours or not theirs:
        return False
    if len(ours) == 1:
        return theirs.startswith(ours)
    return theirs.startswith(ours) or ours.startswith(theirs)

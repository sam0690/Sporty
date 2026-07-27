"""The football competitions Sporty tracks, keyed by API-Football league id.

Two roles, distinguished by the `fantasy` flag:
  - fantasy=True  (EPL/La Liga/Bundesliga): drive the fantasy player pool,
    scoping, match sync into the `matches` table, and live scoring.
  - fantasy=False (Champions League): DISPLAY ONLY — shown on the public
    competition pages (standings/fixtures/results/stats/bracket) via the
    snapshot layer, never a fantasy option and never in the scoring `matches`
    table.

Adding a fantasy competition needs fdo-name aliases in match_sync.py and a
squad-seeding run. A display-only competition needs neither — the snapshot
layer reads football-data.org directly.
"""

from typing import NamedTuple


class Competition(NamedTuple):
    fdo_code: str  # football-data.org competition code (schedule source)
    name: str      # display name, stored on Match.competition
    tag: str       # RealTeam.competition value / competition-page key
    fantasy: bool = True  # False = display-only (not a fantasy option)


FOOTBALL_COMPETITIONS: dict[int, Competition] = {
    39: Competition("PL", "Premier League", "EPL"),
    140: Competition("PD", "La Liga", "LALIGA"),
    78: Competition("BL1", "Bundesliga", "BUNDESLIGA"),
    # Display-only — competition pages, never fantasy.
    2: Competition("CL", "Champions League", "UCL", fantasy=False),
}


def fantasy_competitions() -> dict[int, Competition]:
    """Fantasy-eligible competitions only (excludes display-only ones like
    the Champions League). Player pools, scoping, match sync, and live scoring
    use THIS, not the full registry."""
    return {k: v for k, v in FOOTBALL_COMPETITIONS.items() if v.fantasy}


# Reverse lookup: Match.competition display name → fantasy tag ("Premier
# League" → "EPL"). Returns None for non-fantasy/unknown competitions (incl.
# non-football sports and display-only UCL), which is exactly what the window
# locator wants — a NULL tag means "no per-competition schedule, use the
# combined/NULL windows".
_NAME_TO_TAG: dict[str, str] = {
    c.name: c.tag for c in FOOTBALL_COMPETITIONS.values() if c.fantasy
}


def fantasy_tag_for_competition_name(name: str | None) -> str | None:
    """Fantasy competition tag for a Match.competition display name, or None."""
    return _NAME_TO_TAG.get(name or "")

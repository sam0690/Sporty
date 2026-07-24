"""The football competitions Sporty tracks, keyed by API-Football league id.

Adding a competition here (plus fdo-name aliases in match_sync.py and a
seeding run for its squads) is all the sync layer needs — the live poll,
predictions, and FT-sheet paths are already league-agnostic.
"""

from typing import NamedTuple


class Competition(NamedTuple):
    fdo_code: str  # football-data.org competition code (schedule source)
    name: str      # display name, stored on Match.competition
    tag: str       # RealTeam.competition value (league-scoping key)


FOOTBALL_COMPETITIONS: dict[int, Competition] = {
    39: Competition("PL", "Premier League", "EPL"),
    140: Competition("PD", "La Liga", "LALIGA"),
    78: Competition("BL1", "Bundesliga", "BUNDESLIGA"),
}

"""Canonical real-team names.

Different data sources spell the same club differently — the two EPL stat CSVs
alone disagree ("Liverpool" vs "Liverpool FC"), which is how Liverpool's whole
roster got seeded twice (see alembic e6f7a8b9c0d1 and its follow-up merge
migration). Every path that turns a team name into an identity (player/team
external_api_id slugs, RealTeam name matching, match crest lookups) must
canonicalise through here first.

Explicit alias map, not fuzzy matching — same policy as the feeder-side fix.
Names not in the map pass through unchanged, so non-football sports are safe.
"""

TEAM_NAME_ALIASES: dict[str, str] = {
    "Brighton": "Brighton &amp; Hove Albion",
    "Newcastle": "Newcastle United",
    "Tottenham": "Tottenham Hotspur",
    "West Ham": "West Ham United",
    "Wolves": "Wolverhampton",
    "Liverpool FC": "Liverpool",
}


def canonical_team_name(name: str) -> str:
    """Map a raw source team name to its canonical form (pass-through if unknown)."""
    return TEAM_NAME_ALIASES.get(name.strip(), name.strip())

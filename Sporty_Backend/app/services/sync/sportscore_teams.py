"""Our RealTeam.name -> SportScore club slug, for the fantasy competitions.

Same shape and same maintenance burden as _FDO_NAME_ALIASES in match_sync.py:
a hand-maintained map reconciling one provider's club naming with ours, because
there is no shared id space. ~6 clubs change per season on promotion and
relegation — UPDATE THIS AFTER EVERY PROMOTION/RELEGATION.

Do NOT regenerate this by scripting their /team/ endpoint unattended: it
FUZZY-matches, and a plain slug silently resolves to a reserve or youth side —
"alaves" returns Alavés B, "bayern-munchen" returns Bayern Munchen II,
"espanyol" returns Espanyol U19. Every entry below was verified 2026-08-16 by
checking that the payload's own canonical slug matched the request AND that the
club's fixture list contained the expected league.

The match slug is "{club-a}-vs-{club-b}" and is ORDER-INSENSITIVE — both
orderings resolve to the same fixture — so build_match_slug doesn't need to
know which side is at home.
"""

import logging

logger = logging.getLogger(__name__)

# Verified 2026-08-16 against SportScore. Comment = their display name where it
# differs from ours, so a future mismatch is reviewable without a network call.
SPORTSCORE_TEAM_SLUGS: dict[str, str] = {
    # ── Bundesliga ──
    "1. FC Köln": "fc-koln",
    "1899 Hoffenheim": "tsg-hoffenheim",              # TSG Hoffenheim
    "Bayer Leverkusen": "bayer-04-leverkusen",        # Bayer 04 Leverkusen
    "Bayern München": "fc-bayern-munich",             # FC Bayern Munich
    "Borussia Dortmund": "borussia-dortmund",
    "Borussia Mönchengladbach": "borussia-monchengladbach",
    "Eintracht Frankfurt": "eintracht-frankfurt",
    "FC Augsburg": "fc-augsburg",
    "FC Schalke 04": "schalke-04",                    # Schalke 04
    "FSV Mainz 05": "1-fsv-mainz-05",                 # 1. FSV Mainz 05
    "Hamburger SV": "hamburger-sv",
    "RB Leipzig": "rb-leipzig",
    "SC Freiburg": "sc-freiburg",
    "SC Paderborn 07": "sc-paderborn-07",
    "SV Elversberg": "sv-elversberg",
    "Union Berlin": "1-fc-union-berlin",              # 1. FC Union Berlin
    "VfB Stuttgart": "vfb-stuttgart",
    "Werder Bremen": "sv-werder-bremen",              # SV Werder Bremen
    # ── Premier League ──
    "Arsenal": "arsenal",
    "Aston Villa": "aston-villa",
    "Bournemouth": "bournemouth-afc",                 # Bournemouth AFC
    "Brentford": "brentford",
    "Brighton & Hove Albion": "brighton-hove-albion",
    "Chelsea": "chelsea",
    "Coventry City": "coventry-city",
    "Crystal Palace": "crystal-palace",
    "Everton": "everton",
    "Fulham": "fulham",
    "Hull City": "hull-city",
    "Ipswich Town": "ipswich-town",
    "Leeds United": "leeds-united",
    "Liverpool": "liverpool",
    "Manchester City": "manchester-city",
    "Manchester United": "manchester-united",
    "Newcastle United": "newcastle-united",
    "Nottingham Forest": "nottingham-forest",
    "Sunderland": "sunderland",
    "Tottenham Hotspur": "tottenham-hotspur",
    # ── La Liga ──
    "Alaves": "deportivo-alaves",                     # Deportivo Alavés
    "Athletic Club": "athletic-club",
    "Atletico Madrid": "atletico-madrid",
    "Barcelona": "fc-barcelona",                      # FC Barcelona
    "Celta Vigo": "rc-celta",                         # RC Celta
    "Deportivo La Coruna": "deportivo-la-coruna",
    "Elche": "elche-cf",                              # Elche CF
    "Espanyol": "rcd-espanyol-de-barcelona",          # RCD Espanyol de Barcelona
    "Getafe": "getafe",
    "Levante": "levante",
    "Malaga": "malaga",
    "Osasuna": "ca-osasuna",                          # CA Osasuna
    "Racing Santander": "racing-santander",
    "Rayo Vallecano": "rayo-vallecano",
    "Real Betis": "real-betis",
    "Real Madrid": "real-madrid",
    "Real Sociedad": "real-sociedad",
    "Sevilla": "sevilla-fc",                          # Sevilla FC
    "Valencia": "valencia-cf",                        # Valencia CF
    "Villarreal": "villarreal-cf",                    # Villarreal CF
}


def build_match_slug(home_team: str | None, away_team: str | None) -> str | None:
    """Their fixture slug for one of our matches, or None if either club is
    unmapped.

    A miss is LOUD, not silent: an unmapped club means that fixture gets no live
    coverage at all, and the lesson from _parse_player_sheet (a silent skip cost
    Mikel Rodríguez a goal and nobody noticed) is that a quiet drop goes
    unnoticed for weeks. Callers rely on this warning naming the club.
    """
    home_slug = SPORTSCORE_TEAM_SLUGS.get(home_team or "")
    away_slug = SPORTSCORE_TEAM_SLUGS.get(away_team or "")
    if not home_slug or not away_slug:
        missing = [
            name for name, slug in ((home_team, home_slug), (away_team, away_slug))
            if not slug
        ]
        logger.warning(
            "SportScore: no club slug for %s — %s vs %s gets no live coverage. "
            "Add it to SPORTSCORE_TEAM_SLUGS (promotion/relegation?).",
            ", ".join(repr(m) for m in missing), home_team, away_team,
        )
        return None
    return f"{home_slug}-vs-{away_slug}"


def known_club(name: str | None) -> bool:
    return (name or "") in SPORTSCORE_TEAM_SLUGS

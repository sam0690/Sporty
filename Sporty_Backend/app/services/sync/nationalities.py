"""Nationality name -> ISO 3166-1 alpha-2 code, and the R2 flag URL for it.

Player nationalities arrive as free-text country names from more than one
provider, and the providers disagree with each other and sometimes with
themselves: football-data.org emits both "Congo DR" and "DR Congo", both
"Korea, South" and "South Korea"; TheSportsDB wrote "The Netherlands" where
football-data.org writes "Netherlands". Every spelling actually observed in
our data is mapped here so the flag lookup never depends on which ingestion
path happened to write the row.

The four UK home nations are not ISO countries but have their own flags and
their own football teams, so they use flagcdn's GB subdivision codes
(gb-eng, gb-sct, gb-wls, gb-nir). Kosovo uses the user-assigned "xk".

Flags are served from our own R2 bucket rather than hot-linked, so the URL is
derived from the code rather than stored per player — one bucket key per
country, no column, no join. See scripts/upload_country_flags.py.
"""
from __future__ import annotations

from app.core.config import settings

# Canonical spellings plus every provider variant seen in production.
NATIONALITY_TO_ISO: dict[str, str] = {
    "albania": "al",
    "algeria": "dz",
    "angola": "ao",
    "argentina": "ar",
    "australia": "au",
    "austria": "at",
    "bahamas": "bs",
    "belgium": "be",
    "benin": "bj",
    "bosnia and herzegovina": "ba",
    "bosnia-herzegovina": "ba",
    "brazil": "br",
    "bulgaria": "bg",
    "burkina faso": "bf",
    "cameroon": "cm",
    "canada": "ca",
    "cape verde": "cv",
    "cape verde islands": "cv",
    "chile": "cl",
    "colombia": "co",
    "comoros": "km",
    "congo": "cg",
    "congo dr": "cd",
    "cote d'ivoire": "ci",
    "croatia": "hr",
    "curacao": "cw",
    "czech republic": "cz",
    "czechia": "cz",
    "denmark": "dk",
    "dominican republic": "do",
    "dr congo": "cd",
    "drc": "cd",
    "ecuador": "ec",
    "egypt": "eg",
    "england": "gb-eng",
    "equatorial guinea": "gq",
    "estonia": "ee",
    "finland": "fi",
    "france": "fr",
    "gabon": "ga",
    "gambia": "gm",
    "georgia": "ge",
    "germany": "de",
    "ghana": "gh",
    "greece": "gr",
    "guadeloupe": "gp",
    "guinea": "gn",
    "guinea-bissau": "gw",
    "haiti": "ht",
    "honduras": "hn",
    "hungary": "hu",
    "iceland": "is",
    "indonesia": "id",
    "iran": "ir",
    "iraq": "iq",
    "ireland": "ie",
    "israel": "il",
    "italy": "it",
    "ivory coast": "ci",
    "jamaica": "jm",
    "japan": "jp",
    "korea republic": "kr",
    "korea, south": "kr",
    "kosovo": "xk",
    "latvia": "lv",
    "libya": "ly",
    "lithuania": "lt",
    "luxembourg": "lu",
    "malaysia": "my",
    "mali": "ml",
    "mexico": "mx",
    "montenegro": "me",
    "morocco": "ma",
    "mozambique": "mz",
    "netherlands": "nl",
    "new zealand": "nz",
    "nicaragua": "ni",
    "nigeria": "ng",
    "north macedonia": "mk",
    "northern ireland": "gb-nir",
    "norway": "no",
    "paraguay": "py",
    "peru": "pe",
    "philippines": "ph",
    "poland": "pl",
    "portugal": "pt",
    "puerto rico": "pr",
    "republic of ireland": "ie",
    "romania": "ro",
    "russia": "ru",
    "saint lucia": "lc",
    "scotland": "gb-sct",
    "senegal": "sn",
    "serbia": "rs",
    "sierra leone": "sl",
    "slovakia": "sk",
    "slovenia": "si",
    "south africa": "za",
    "south korea": "kr",
    "south sudan": "ss",
    "spain": "es",
    "suriname": "sr",
    "sweden": "se",
    "switzerland": "ch",
    "thailand": "th",
    "the netherlands": "nl",
    "togo": "tg",
    "trinidad & tobago": "tt",
    "trinidad and tobago": "tt",
    "tunisia": "tn",
    "turkey": "tr",
    "türkiye": "tr",
    "ukraine": "ua",
    "united kingdom": "gb",
    "united states": "us",
    "uruguay": "uy",
    "usa": "us",
    "uzbekistan": "uz",
    "venezuela": "ve",
    "wales": "gb-wls",
    "zambia": "zm",
    "zimbabwe": "zw",
}

FLAG_KEY_PREFIX = "flags"


def iso_code(nationality: str | None) -> str | None:
    """ISO/flagcdn code for a country name, or None if unmapped."""
    if not nationality:
        return None
    return NATIONALITY_TO_ISO.get(nationality.strip().lower())


def flag_key(code: str) -> str:
    """R2 object key for a flag."""
    return f"{FLAG_KEY_PREFIX}/{code}.svg"


def flag_url(nationality: str | None) -> str | None:
    """Public R2 URL of the flag for a nationality, or None if unmapped.

    Derived rather than stored: one object per country, so a per-player
    column would be ~1780 rows repeating ~96 distinct values.
    """
    code = iso_code(nationality)
    if not code or not settings.R2_PUBLIC_URL_BASE:
        return None
    return f"{settings.R2_PUBLIC_URL_BASE.rstrip('/')}/{flag_key(code)}"

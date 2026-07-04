from __future__ import annotations

from decimal import Decimal
from typing import Any

DEFAULT_MAX_PER_CLUB = 3

SPORT_CONFIGS = {
    'football': {
        'squad_size': 15,
        'quota': 15,
        'maxPerClub': 3,
    },
    'basketball': {
        'squad_size': 13,
        'quota': 13,
        'maxPerClub': None,
    },
    'mixed': {
        'squad_size': 15,
        'football_quota': 8,
        'basketball_quota': 7
    }
}

# Single source of truth for position-minimum quotas, by sport and by
# single-vs-mixed league shape. Position codes must match Player.position
# ("GKP", not "GK") or the auto-pick ILP rejects every pool with "cannot
# satisfy required position". Football's "single" minimums (2/5/5/3) sum to
# exactly the 15-player squad size, so a valid single-sport football squad is
# fully constrained (no flex slots). Basketball has no position constraints
# (all players are position "UNK"; the quota already fixes the count, and any
# UNK minimum above the mixed-league basketball quota of 7 would make the ILP
# infeasible).
SPORT_CONFIG_REGISTRY: dict[str, dict[str, dict[str, Any]]] = {
    "football": {
        "single": {
            "position_minimums": {
                "GKP": 2,
                "DEF": 5,
                "MID": 5,
                "FWD": 3,
            },
        },
        "mixed": {
            "position_minimums": {
                "GKP": 1,
                "DEF": 2,
                "MID": 3,
                "FWD": 2,
            },
        },
    },
    "basketball": {
        "single": {
            "position_minimums": {},
        },
        "mixed": {
            "position_minimums": {},
        },
    },
}


def get_position_minimums(sport_type: str, mode: str) -> dict[str, int]:
    """The one place every entry point reads position-minimum quotas from.

    `mode` is "single" or "mixed". Unknown sport/mode combinations return {}
    (no constraint) rather than raising, matching existing "unknown → no
    constraint" behavior elsewhere in the squad-validation code.
    """
    return SPORT_CONFIG_REGISTRY.get(sport_type, {}).get(mode, {}).get(
        "position_minimums", {}
    )


def get_max_per_club(sport_type: str) -> int:
    """Max players allowed from the same real-world club, for `sport_type`.

    Mirrors the `maxPerClub or DEFAULT_MAX_PER_CLUB` fallback the ILP
    optimizer already applies (auto_pick_service.py) so every entry point
    agrees on the same cap, including sports (e.g. basketball) whose
    SPORT_CONFIGS entry sets maxPerClub=None.
    """
    config = SPORT_CONFIGS.get(sport_type, {})
    return int(config.get("maxPerClub") or DEFAULT_MAX_PER_CLUB)


MIXED_SPORT_QUOTAS = {
    "football": 8,
    "basketball": 7,
}

SUPPORTED_SPORT_TYPES = set(SPORT_CONFIG_REGISTRY)


def derive_sport_type(sports: Any) -> str:
    """Derive sport type string from a list of sport names or objects."""
    if not sports:
        return "football"

    names = []
    for s in sports:
        if isinstance(s, str):
            names.append(s.lower())
        elif hasattr(s, "sport") and s.sport:
            names.append(s.sport.name.lower())
        elif hasattr(s, "name"):
            names.append(s.name.lower())
        elif isinstance(s, dict) and "name" in s:
            names.append(s["name"].lower())

    unique = set(names)
    if len(unique) > 1:
        return "mixed"
    return list(unique)[0] if unique else "football"


def build_auto_pick_sport_config(
    sport_type: str,
    *,
    total_budget: Decimal,
    squad_size: int,
) -> dict[str, Any]:
    config = SPORT_CONFIGS.get(sport_type)
    if not config:
        # Fallback if unknown sport
        return {
            "sportType": sport_type,
            "totalBudget": total_budget,
            "maxPerClub": DEFAULT_MAX_PER_CLUB,
            "sports": [{"type": sport_type, "quota": squad_size}],
            "squad_size": squad_size,
        }

    if sport_type == "mixed":
        # Mixed quotas are 8 + 7, so the per-sport minimums must come from the
        # registry's "mixed" entries — the single-league minimums assume full
        # 15/13-player squads and are infeasible here.
        sports = [
            {
                "type": "football",
                "quota": config.get("football_quota", 8),
                "position_minimums": get_position_minimums("football", "mixed"),
            },
            {
                "type": "basketball",
                "quota": config.get("basketball_quota", 7),
                "position_minimums": get_position_minimums("basketball", "mixed"),
            },
        ]
    else:
        sports = [
            {
                "type": sport_type,
                "quota": config["quota"],
                "position_minimums": get_position_minimums(sport_type, "single"),
            }
        ]

    return {
        "sportType": sport_type,
        "totalBudget": total_budget,
        "maxPerClub": config.get("maxPerClub", DEFAULT_MAX_PER_CLUB),
        "sports": sports,
        "squad_size": config["squad_size"],
    }

from __future__ import annotations

from decimal import Decimal
from typing import Any

DEFAULT_MAX_PER_CLUB = 3

SPORT_CONFIGS = {
    'football': {
        'squad_size': 15,
        'quota': 15,
        'maxPerClub': 3,
        # Position codes must match Player.position ("GKP", not "GK") or the
        # auto-pick ILP rejects every pool with "cannot satisfy required position".
        'position_minimums': { 'GKP': 1, 'DEF': 3, 'MID': 2, 'FWD': 1 }
    },
    'basketball': {
        'squad_size': 13,
        'quota': 13,
        'maxPerClub': None,
        # Basketball players are all position "UNK"; the quota already fixes the
        # count, and any UNK minimum above the mixed-league basketball quota (7)
        # makes the ILP infeasible. No position constraints.
        'position_minimums': {}
    },
    'mixed': {
        'squad_size': 15,
        'football_quota': 8,
        'basketball_quota': 7
    }
}

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
            "position_minimums": {
                "UNK": 15,
            },
        },
        "mixed": {
            "position_minimums": {
                "UNK": 7,
            },
        },
    },
}

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
        # registry's "mixed" entries — the single-league minimums in
        # SPORT_CONFIGS assume full 15/13-player squads and are infeasible here.
        sports = [
            {
                "type": "football",
                "quota": config.get("football_quota", 8),
                "position_minimums": SPORT_CONFIG_REGISTRY["football"]["mixed"]["position_minimums"],
            },
            {
                "type": "basketball",
                "quota": config.get("basketball_quota", 7),
                "position_minimums": SPORT_CONFIG_REGISTRY["basketball"]["mixed"]["position_minimums"],
            },
        ]
    else:
        sports = [
            {
                "type": sport_type,
                "quota": config["quota"],
                "position_minimums": config["position_minimums"],
            }
        ]

    return {
        "sportType": sport_type,
        "totalBudget": total_budget,
        "maxPerClub": config.get("maxPerClub", DEFAULT_MAX_PER_CLUB),
        "sports": sports,
        "squad_size": config["squad_size"],
    }

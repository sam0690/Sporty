from __future__ import annotations

from decimal import Decimal
from typing import Any

DEFAULT_MAX_PER_CLUB = 3

SPORT_CONFIG_REGISTRY: dict[str, dict[str, dict[str, Any]]] = {
    "football": {
        "single": {
            "position_minimums": {
                "GK": 1,
                "DEF": 3,
                "MID": 2,
                "FWD": 1,
            },
        },
        "mixed": {
            "position_minimums": {
                "GK": 1,
                "DEF": 2,
                "MID": 2,
                "FWD": 1,
            },
        },
    },
    "basketball": {
        "single": {
            "position_minimums": {
                "PG": 1,
                "SG": 1,
                "SF": 1,
                "PF": 1,
                "C": 1,
            },
        },
        "mixed": {
            "position_minimums": {
                "PG": 1,
                "SG": 1,
                "SF": 1,
                "PF": 1,
                "C": 1,
            },
        },
    },
}

MIXED_SPORT_QUOTAS = {
    "football": 8,
    "basketball": 7,
}

SUPPORTED_SPORT_TYPES = set(SPORT_CONFIG_REGISTRY)


def build_auto_pick_sport_config(
    sport_type: str,
    *,
    total_budget: Decimal,
    squad_size: int,
) -> dict[str, Any]:
    if sport_type == "mixed":
        sports = [
            {
                "type": "football",
                "quota": MIXED_SPORT_QUOTAS["football"],
                "position_minimums": SPORT_CONFIG_REGISTRY["football"]["mixed"]["position_minimums"],
            },
            {
                "type": "basketball",
                "quota": MIXED_SPORT_QUOTAS["basketball"],
                "position_minimums": SPORT_CONFIG_REGISTRY["basketball"]["mixed"]["position_minimums"],
            },
        ]
    else:
        sports = [
            {
                "type": sport_type,
                "quota": int(squad_size),
                "position_minimums": SPORT_CONFIG_REGISTRY[sport_type]["single"]["position_minimums"],
            }
        ]

    return {
        "sportType": sport_type,
        "totalBudget": total_budget,
        "maxPerClub": DEFAULT_MAX_PER_CLUB,
        "sports": sports,
    }

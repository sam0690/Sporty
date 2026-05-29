from __future__ import annotations

from decimal import Decimal
from typing import Any

DEFAULT_MAX_PER_CLUB = 3

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
        # For single sport, we use "single" config but scaling position minimums 
        # if the squad_size is different from 15 (FPL standard).
        config = SPORT_CONFIG_REGISTRY[sport_type]["single"]
        pos_mins = config["position_minimums"].copy()
        
        # Simple safety: if squad_size < sum(min_positions), we must reduce them.
        # This prevents "infeasible" ILP results for custom leagues with small squads.
        sum_mins = sum(pos_mins.values())
        if squad_size < sum_mins:
            # Fallback to 1 per position if possible, otherwise scale down.
            for pos in pos_mins:
                pos_mins[pos] = 1
            
            # Re-check if still too high
            sum_mins = sum(pos_mins.values())
            if squad_size < sum_mins:
                for pos in pos_mins:
                    pos_mins[pos] = 0 # Extreme fallback

        sports = [
            {
                "type": sport_type,
                "quota": int(squad_size),
                "position_minimums": pos_mins,
            }
        ]

    return {
        "sportType": sport_type,
        "totalBudget": total_budget,
        "maxPerClub": DEFAULT_MAX_PER_CLUB,
        "sports": sports,
    }

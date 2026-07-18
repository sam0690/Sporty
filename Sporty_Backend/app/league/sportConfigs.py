from __future__ import annotations

from decimal import Decimal
from typing import Any

DEFAULT_MAX_PER_CLUB = 3

# ═══════════════════════════════════════════════════════════════════════════
# THE single source of truth for per-sport squad rules.
#
# This replaces three overlapping registries (SPORT_CONFIGS,
# SPORT_CONFIG_REGISTRY, MIXED_SPORT_QUOTAS) that each held part of the
# picture — the mixed 8/7 split was literally defined twice. Every entry
# point reads through the accessor functions below; adding a sport (e.g.
# cricket) means adding ONE entry here.
#
# Position codes must match Player.position ("GKP", not "GK") or the
# auto-pick ILP rejects every pool with "cannot satisfy required position".
# Football's "single" minimums (2/5/5/3) sum to exactly the 15-player squad
# size, so a valid single-sport football squad is fully constrained (no flex
# slots). Basketball intentionally has no position constraints: most players
# now carry a real PG/SG/SF/PF/C code (backfilled 2026-07-18, see
# scripts/backfill_basketball_positions.py), but ~76 players not on a
# current NBA roster are still "UNK" and never will be, so any per-position
# minimum here risks making the ILP infeasible for pools that draw one of
# them. Add real minimums only alongside a plan for that permanent UNK tail.
# ═══════════════════════════════════════════════════════════════════════════

SPORT_REGISTRY: dict[str, dict[str, Any]] = {
    "football": {
        "squad_size": 15,
        "quota": 15,
        "max_per_club": 3,
        "position_minimums": {
            "single": {"GKP": 2, "DEF": 5, "MID": 5, "FWD": 3},
            "mixed": {"GKP": 1, "DEF": 2, "MID": 3, "FWD": 2},
        },
    },
    "basketball": {
        "squad_size": 13,
        "quota": 13,
        "max_per_club": None,  # accessor falls back to DEFAULT_MAX_PER_CLUB
        "position_minimums": {"single": {}, "mixed": {}},
    },
    "mixed": {
        "squad_size": 15,
        "quotas": {"football": 8, "basketball": 7},
    },
}

# Per-sport quotas for mixed leagues — a VIEW of the registry, not a second
# definition (squad/services iterates this when validating mixed squads).
MIXED_SPORT_QUOTAS: dict[str, int] = SPORT_REGISTRY["mixed"]["quotas"]

SUPPORTED_SPORT_TYPES = {name for name in SPORT_REGISTRY if name != "mixed"}


def get_squad_size(sport_type: str, default: int = 15) -> int:
    """Squad size for a sport type ("football" | "basketball" | "mixed")."""
    return int(SPORT_REGISTRY.get(sport_type, {}).get("squad_size", default))


def get_position_minimums(sport_type: str, mode: str) -> dict[str, int]:
    """The one place every entry point reads position-minimum quotas from.

    `mode` is "single" or "mixed". Unknown sport/mode combinations return {}
    (no constraint) rather than raising, matching existing "unknown → no
    constraint" behavior elsewhere in the squad-validation code.
    """
    return SPORT_REGISTRY.get(sport_type, {}).get("position_minimums", {}).get(mode, {})


def get_max_per_club(sport_type: str) -> int:
    """Max players allowed from the same real-world club, for `sport_type`.

    Mirrors the `max_per_club or DEFAULT_MAX_PER_CLUB` fallback the ILP
    optimizer applies so every entry point agrees on the same cap, including
    sports (e.g. basketball) whose entry sets max_per_club=None.
    """
    config = SPORT_REGISTRY.get(sport_type, {})
    return int(config.get("max_per_club") or DEFAULT_MAX_PER_CLUB)


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
    config = SPORT_REGISTRY.get(sport_type)
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
                "type": name,
                "quota": quota,
                "position_minimums": get_position_minimums(name, "mixed"),
            }
            for name, quota in MIXED_SPORT_QUOTAS.items()
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
        "maxPerClub": config.get("max_per_club") or DEFAULT_MAX_PER_CLUB,
        "sports": sports,
        "squad_size": config["squad_size"],
    }

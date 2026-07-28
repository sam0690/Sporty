"""Config-driven, position-aware football scoring interpreter.

The FORMULA is data, not code. A `DefaultScoringRule` row carries an action,
a position scope (GKP/DEF/MID/FWD or NULL=all), a `points` value, and a `mode`
that says how to apply the points to the action's metric count. This module
owns only the *meaning* of each action (which stat it counts) and how each mode
turns a count into points — everything an admin would want to retune
(values, thresholds, position weighting) lives in the DB.

Used by the batch gameweek scorer, the live path, and recalculation, so all
three agree by construction (no more three hand-synced formulas).
"""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal


# action key -> how to read its count from a stats dict. This is the one place
# that encodes what an action *means*; points/mode/position stay in config.
# Composite actions (defensive_contribution) sum their parts here.
METRIC_RESOLVERS: dict[str, callable] = {
    # Appearance is minutes-thresholded (see the seeded rules: two threshold
    # rules on `minutes`, at >=1 and >=60, so <60' = base, 60'+ = base+full).
    "appearance": lambda s: s.get("minutes", 0),
    "appearance_full": lambda s: s.get("minutes", 0),
    "goal": lambda s: s.get("goals", 0),
    "assist": lambda s: s.get("assists", 0),
    "clean_sheet": lambda s: s.get("clean_sheets", 0),
    "save": lambda s: s.get("saves", 0),
    "penalty_save": lambda s: s.get("penalties_saved", 0),
    "penalty_miss": lambda s: s.get("penalties_missed", 0),
    "own_goal": lambda s: s.get("own_goals", 0),
    "conceded": lambda s: s.get("goals_conceded", 0),
    "yellow_card": lambda s: s.get("yellow_cards", 0),
    "red_card": lambda s: s.get("red_cards", 0),
    # Advanced (populated once the FT-sheet parser captures them; the rules can
    # be seeded now and simply score 0 until the metrics arrive).
    "defensive_contribution": lambda s: (
        s.get("tackles", 0) + s.get("interceptions", 0)
        + s.get("blocks", 0) + s.get("clearances", 0)
    ),
    "key_pass": lambda s: s.get("key_passes", 0),
    "shot_on_target": lambda s: s.get("shots_on_target", 0),
    "dribble": lambda s: s.get("dribbles_won", 0),
}


@dataclass(frozen=True)
class Rule:
    action: str
    position: str | None  # None = applies to every position
    mode: str             # per_unit | per_n | threshold | flat
    param: Decimal | None
    points: Decimal


def _apply(mode: str, points: Decimal, param: Decimal | None, count: int) -> Decimal:
    if count <= 0 and mode != "flat":
        # threshold/per_n/per_unit all yield 0 at count 0; short-circuit.
        if not (mode == "threshold" and param is not None and param <= 0):
            return Decimal("0")
    if mode == "per_unit":
        return Decimal(count) * points
    if mode == "per_n":
        n = int(param or 1) or 1
        return Decimal(count // n) * points
    if mode == "threshold":
        return points if count >= int(param or 0) else Decimal("0")
    if mode == "flat":
        return points if count > 0 else Decimal("0")
    return Decimal("0")


def compute_football_score(
    position: str | None,
    stats: dict,
    rules: list[Rule],
) -> tuple[Decimal, list[dict]]:
    """Return (total_points, breakdown) for one player-match/window.

    `stats` is a plain dict of metric name -> count (minutes, goals, saves,
    tackles, …). `rules` is the sport's full rule set; each rule is applied
    only when its position scope matches (or is None). Every non-zero
    contribution is recorded in the breakdown so the total is explainable.
    """
    total = Decimal("0")
    breakdown: list[dict] = []
    for rule in rules:
        if rule.position is not None and rule.position != position:
            continue
        resolver = METRIC_RESOLVERS.get(rule.action)
        if resolver is None:
            continue
        count = int(resolver(stats) or 0)
        subtotal = _apply(rule.mode, rule.points, rule.param, count)
        if subtotal == 0:
            continue
        total += subtotal
        breakdown.append({
            "action": rule.action,
            "position": rule.position,
            "count": count,
            "mode": rule.mode,
            "points_each": float(rule.points),
            "subtotal": float(subtotal),
        })
    return total, breakdown

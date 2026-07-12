"""Beat the Optimizer — weekly hindsight lineup score.

Re-runs the same ILP solver the "Auto-Optimize Lineup" button already calls
(app/services/optimization/ilp_optimizer.py), but fed REAL fantasy_points for
an already-scored window instead of pre-match projections, over the exact
squad that was set that week. Compares the result to what the team actually
scored (already computed by resolve_team_gameweek).

Deliberately no persistence: the ILP problem here is tiny (a squad's worth of
candidates, a handful of binary vars) and optimize_lineup is a pure function
with no DB access, so it's cheap enough to recompute on every recap view.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from decimal import Decimal

from app.player.models import Player
from app.services.optimization.ilp_optimizer import (
    CandidatePlayer,
    LineupOptimizationError,
    OptimizerConstraints,
    PositionConstraint,
    optimize_lineup,
)
from app.services.scoring.team_scoring import LineupRow


@dataclass(frozen=True)
class HindsightResult:
    best_possible_points: Decimal
    capture_rate: float  # 0-100


def compute_hindsight_lineup(
    *,
    rows: list[LineupRow],
    players_by_id: dict[uuid.UUID, Player],
    slot_bounds: dict[tuple[uuid.UUID, str], tuple[int, int]],
    actual_total_points: Decimal,
) -> HindsightResult | None:
    """None if there's nothing sensible to compute (empty squad, ILP
    infeasible, or the sanity guard trips) — callers should just omit the
    hindsight fields rather than fail the whole recap."""
    if not rows:
        return None

    starters = sum(1 for r in rows if r.is_starter)
    # optimize_lineup always assigns a captain AND a distinct vice-captain
    # (c[pid] + v[pid] <= 1, but sum(c)==1 and sum(v)==1) — structurally
    # infeasible with fewer than 2 selected players. Never a real concern in
    # production (starters is 11+/5+/11+ per sport), but guard it rather
    # than let a pathological tiny-formation league hit LineupOptimizationError.
    if starters < 2:
        return None

    candidates: list[CandidatePlayer] = []
    for row in rows:
        player = players_by_id.get(row.player_id)
        if player is None:
            continue
        candidates.append(
            CandidatePlayer(
                id=str(row.player_id),
                sport=player.sport.name,
                position=row.position or player.position,
                club=player.real_team,
                cost=player.cost,
                projected_points=row.points,  # real fantasy_points for this window
                is_available=True,
            )
        )
    if len(candidates) < starters:
        return None

    # Position codes never collide across sports on this platform (football
    # GKP/DEF/MID/FWD, cricket BAT/BOWL/AR/WK, ...), so the sport_id can be
    # dropped from slot_bounds' composite key — same simplification the real
    # auto-subs path (auto_subs.py) already relies on, which only ever sees
    # slot_bounds, never a separate per-sport constraint.
    positions = {
        position: PositionConstraint(min=min_count, max=max_count)
        for (_sport_id, position), (min_count, max_count) in slot_bounds.items()
    }

    constraints = OptimizerConstraints(
        budget=sum((c.cost for c in candidates), Decimal("0")),
        squad_size=starters,
        positions=positions,
        sports={},
        # Non-binding by construction: candidates are a subset of an
        # already-valid squad, which can't violate a club cap that squad
        # already satisfied. Set generously rather than re-deriving a
        # per-sport max (ambiguous for multi-sport leagues) for a
        # constraint that can never actually bind here.
        max_per_club=len(candidates),
        locked_player_ids=set(),
        banned_player_ids=set(),
        vice_bonus_multiplier=Decimal("0"),
    )

    try:
        outcome = optimize_lineup(candidates=candidates, constraints=constraints)
    except LineupOptimizationError:
        return None

    best_possible_points = Decimal(str(outcome["projected_points_with_captain_bonus"]))

    # Sanity guard: the optimizer searches a superset of choices that
    # includes the lineup actually set, so best_possible must be >= actual.
    # If it isn't, something's inconsistent between the two systems (rule-
    # based scoring vs. ILP objective) — omit rather than show a nonsensical
    # negative "capture rate".
    if best_possible_points < actual_total_points:
        return None

    if best_possible_points == 0:
        capture_rate = 100.0
    else:
        capture_rate = float(actual_total_points / best_possible_points * 100)

    return HindsightResult(
        best_possible_points=best_possible_points,
        capture_rate=round(capture_rate, 1),
    )

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

import pulp


class LineupOptimizationError(ValueError):
    pass


@dataclass(frozen=True)
class CandidatePlayer:
    id: str
    sport: str
    position: str
    club: str
    cost: Decimal
    projected_points: Decimal
    is_available: bool


@dataclass(frozen=True)
class PositionConstraint:
    min: int = 0
    max: int | None = None
    exact: int | None = None


@dataclass(frozen=True)
class OptimizerConstraints:
    budget: Decimal
    squad_size: int
    positions: dict[str, PositionConstraint]
    sports: dict[str, PositionConstraint]
    max_per_club: int
    locked_player_ids: set[str]
    banned_player_ids: set[str]
    vice_bonus_multiplier: Decimal = Decimal("0")


def _diagnose_infeasible(
    candidates: list[CandidatePlayer],
    constraints: OptimizerConstraints,
) -> str:
    available = [player for player in candidates if player.is_available]
    available_ids = {player.id for player in available}

    if constraints.locked_player_ids & constraints.banned_player_ids:
        return "Locked and banned player sets overlap"
    if not constraints.locked_player_ids.issubset(available_ids):
        return "One or more locked players are unavailable or missing"
    if len(available) < constraints.squad_size:
        return "Not enough available players for squad_size"

    cheapest = sorted((player.cost for player in available))
    if len(cheapest) >= constraints.squad_size:
        min_possible_cost = sum(cheapest[: constraints.squad_size])
        if min_possible_cost > constraints.budget:
            return "Budget too low for minimum feasible squad"

    for position, rule in constraints.positions.items():
        count = sum(1 for player in available if player.position == position)
        required = rule.exact if rule.exact is not None else rule.min
        if count < required:
            return f"Insufficient players for required position '{position}'"

    for sport, rule in constraints.sports.items():
        count = sum(1 for player in available if player.sport == sport)
        required = rule.exact if rule.exact is not None else rule.min
        if count < required:
            return f"Insufficient players for required sport '{sport}'"

    return "Optimization infeasible under current constraints"


def optimize_lineup(
    *,
    candidates: list[CandidatePlayer],
    constraints: OptimizerConstraints,
) -> dict[str, object]:
    # Algorithm: maximize projected lineup points with captain bonus under budget/squad/position/club/lock/ban constraints using binary ILP.
    if constraints.locked_player_ids & constraints.banned_player_ids:
        raise LineupOptimizationError("Locked and banned players conflict")

    available = [player for player in candidates if player.is_available and player.id not in constraints.banned_player_ids]
    if len(available) < constraints.squad_size:
        raise LineupOptimizationError("Not enough available players to satisfy squad_size")

    players_by_id = {player.id: player for player in available}

    if not constraints.locked_player_ids.issubset(players_by_id.keys()):
        raise LineupOptimizationError("Some locked players are unavailable or missing from candidates")

    model = pulp.LpProblem("lineup_optimizer", pulp.LpMaximize)

    x = {pid: pulp.LpVariable(f"x_{pid}", cat=pulp.LpBinary) for pid in players_by_id}
    c = {pid: pulp.LpVariable(f"c_{pid}", cat=pulp.LpBinary) for pid in players_by_id}
    v = {pid: pulp.LpVariable(f"v_{pid}", cat=pulp.LpBinary) for pid in players_by_id}

    score_expr = pulp.lpSum(
        [
            x[pid] * float(player.projected_points)
            + c[pid] * float(player.projected_points)
            + v[pid] * float(player.projected_points * constraints.vice_bonus_multiplier)
            for pid, player in players_by_id.items()
        ]
    )

    cost_tie_break = pulp.lpSum([x[pid] * float(player.cost) for pid, player in players_by_id.items()])
    model += score_expr - (0.000001 * cost_tie_break)

    model += pulp.lpSum([x[pid] for pid in players_by_id]) == constraints.squad_size
    model += pulp.lpSum([x[pid] * float(players_by_id[pid].cost) for pid in players_by_id]) <= float(constraints.budget)

    for position, rule in constraints.positions.items():
        pos_expr = pulp.lpSum([x[pid] for pid, player in players_by_id.items() if player.position == position])
        if rule.exact is not None:
            model += pos_expr == rule.exact
        else:
            model += pos_expr >= rule.min
            if rule.max is not None:
                model += pos_expr <= rule.max

    for sport, rule in constraints.sports.items():
        sport_expr = pulp.lpSum([x[pid] for pid, player in players_by_id.items() if player.sport == sport])
        if rule.exact is not None:
            model += sport_expr == rule.exact
        else:
            model += sport_expr >= rule.min
            if rule.max is not None:
                model += sport_expr <= rule.max

    clubs = {player.club for player in players_by_id.values()}
    for club in clubs:
        club_expr = pulp.lpSum([x[pid] for pid, player in players_by_id.items() if player.club == club])
        model += club_expr <= constraints.max_per_club

    model += pulp.lpSum([c[pid] for pid in players_by_id]) == 1
    model += pulp.lpSum([v[pid] for pid in players_by_id]) == 1

    for pid in players_by_id:
        model += c[pid] <= x[pid]
        model += v[pid] <= x[pid]
        model += c[pid] + v[pid] <= 1

    for pid in constraints.locked_player_ids:
        model += x[pid] == 1

    solver = pulp.PULP_CBC_CMD(msg=False)
    status_code = model.solve(solver)
    status = pulp.LpStatus.get(status_code, "Unknown")

    if status != "Optimal":
        diagnostic = _diagnose_infeasible(candidates, constraints)
        raise LineupOptimizationError(f"ILP infeasible: {diagnostic}. Solver status={status}")

    selected_ids = sorted([pid for pid in players_by_id if pulp.value(x[pid]) >= 0.5])
    captain_ids = [pid for pid in players_by_id if pulp.value(c[pid]) >= 0.5]
    vice_ids = [pid for pid in players_by_id if pulp.value(v[pid]) >= 0.5]

    captain_id = captain_ids[0] if captain_ids else None
    vice_id = vice_ids[0] if vice_ids else None

    total_cost = sum(players_by_id[pid].cost for pid in selected_ids)
    projected_no_bonus = sum(players_by_id[pid].projected_points for pid in selected_ids)
    projected_with_bonus = projected_no_bonus
    if captain_id is not None:
        projected_with_bonus += players_by_id[captain_id].projected_points
    if vice_id is not None and constraints.vice_bonus_multiplier != Decimal("0"):
        projected_with_bonus += players_by_id[vice_id].projected_points * constraints.vice_bonus_multiplier

    return {
        "selected_player_ids": selected_ids,
        "captain_player_id": captain_id,
        "vice_captain_player_id": vice_id,
        "total_cost": total_cost,
        "projected_points_without_multiplier": projected_no_bonus,
        "projected_points_with_captain_bonus": projected_with_bonus,
        "solver_status": status,
    }

from __future__ import annotations

from decimal import Decimal

import pytest

from app.services.optimization.ilp_optimizer import (
    CandidatePlayer,
    LineupOptimizationError,
    OptimizerConstraints,
    PositionConstraint,
    optimize_lineup,
)


def _base_candidates() -> list[CandidatePlayer]:
    return [
        CandidatePlayer(id="1", sport="football", position="GKP", club="A", cost=Decimal("5"), projected_points=Decimal("10"), is_available=True),
        CandidatePlayer(id="2", sport="football", position="DEF", club="A", cost=Decimal("6"), projected_points=Decimal("9"), is_available=True),
        CandidatePlayer(id="3", sport="football", position="DEF", club="B", cost=Decimal("4"), projected_points=Decimal("8"), is_available=True),
        CandidatePlayer(id="4", sport="football", position="MID", club="B", cost=Decimal("7"), projected_points=Decimal("12"), is_available=True),
        CandidatePlayer(id="5", sport="football", position="FWD", club="C", cost=Decimal("8"), projected_points=Decimal("13"), is_available=True),
        CandidatePlayer(id="6", sport="football", position="MID", club="C", cost=Decimal("5"), projected_points=Decimal("7"), is_available=True),
    ]


def _base_constraints() -> OptimizerConstraints:
    return OptimizerConstraints(
        budget=Decimal("30"),
        squad_size=4,
        positions={
            "GKP": PositionConstraint(min=1, max=1),
            "DEF": PositionConstraint(min=1, max=2),
            "MID": PositionConstraint(min=1, max=2),
            "FWD": PositionConstraint(min=0, max=1),
        },
        sports={},
        max_per_club=2,
        locked_player_ids=set(),
        banned_player_ids=set(),
    )


def test_optimizer_feasible_baseline_case() -> None:
    result = optimize_lineup(candidates=_base_candidates(), constraints=_base_constraints())
    assert result["solver_status"] == "Optimal"
    assert len(result["selected_player_ids"]) == 4


def test_optimizer_budget_infeasible_case() -> None:
    constraints = _base_constraints()
    constraints = OptimizerConstraints(
        budget=Decimal("5"),
        squad_size=constraints.squad_size,
        positions=constraints.positions,
        sports=constraints.sports,
        max_per_club=constraints.max_per_club,
        locked_player_ids=constraints.locked_player_ids,
        banned_player_ids=constraints.banned_player_ids,
    )
    with pytest.raises(LineupOptimizationError):
        optimize_lineup(candidates=_base_candidates(), constraints=constraints)


def test_optimizer_locked_banned_conflict_case() -> None:
    constraints = _base_constraints()
    constraints = OptimizerConstraints(
        budget=constraints.budget,
        squad_size=constraints.squad_size,
        positions=constraints.positions,
        sports=constraints.sports,
        max_per_club=constraints.max_per_club,
        locked_player_ids={"1"},
        banned_player_ids={"1"},
    )
    with pytest.raises(LineupOptimizationError):
        optimize_lineup(candidates=_base_candidates(), constraints=constraints)


def test_optimizer_captain_vice_validity() -> None:
    result = optimize_lineup(candidates=_base_candidates(), constraints=_base_constraints())
    selected = set(result["selected_player_ids"])
    assert result["captain_player_id"] in selected
    assert result["vice_captain_player_id"] in selected
    assert result["captain_player_id"] != result["vice_captain_player_id"]


def test_optimizer_position_constraint_enforcement() -> None:
    constraints = _base_constraints()
    constraints = OptimizerConstraints(
        budget=constraints.budget,
        squad_size=constraints.squad_size,
        positions={
            "GKP": PositionConstraint(exact=1),
            "DEF": PositionConstraint(exact=1),
            "MID": PositionConstraint(exact=1),
            "FWD": PositionConstraint(exact=1),
        },
        sports={},
        max_per_club=constraints.max_per_club,
        locked_player_ids=constraints.locked_player_ids,
        banned_player_ids=constraints.banned_player_ids,
    )
    result = optimize_lineup(candidates=_base_candidates(), constraints=constraints)
    selected = [player for player in _base_candidates() if player.id in result["selected_player_ids"]]
    counts = {"GKP": 0, "DEF": 0, "MID": 0, "FWD": 0}
    for player in selected:
        counts[player.position] += 1
    assert counts == {"GKP": 1, "DEF": 1, "MID": 1, "FWD": 1}


def test_optimizer_multisport_constraints_enforcement() -> None:
    candidates = [
        CandidatePlayer(id="f1", sport="football", position="FWD", club="A", cost=Decimal("6"), projected_points=Decimal("11"), is_available=True),
        CandidatePlayer(id="f2", sport="football", position="MID", club="B", cost=Decimal("6"), projected_points=Decimal("10"), is_available=True),
        CandidatePlayer(id="f3", sport="football", position="DEF", club="C", cost=Decimal("5"), projected_points=Decimal("9"), is_available=True),
        CandidatePlayer(id="b1", sport="basketball", position="PG", club="D", cost=Decimal("7"), projected_points=Decimal("12"), is_available=True),
        CandidatePlayer(id="b2", sport="basketball", position="SG", club="E", cost=Decimal("6"), projected_points=Decimal("10"), is_available=True),
        CandidatePlayer(id="b3", sport="basketball", position="PF", club="F", cost=Decimal("6"), projected_points=Decimal("9"), is_available=True),
    ]

    constraints = OptimizerConstraints(
        budget=Decimal("40"),
        squad_size=4,
        positions={},
        sports={
            "football": PositionConstraint(exact=2),
            "basketball": PositionConstraint(exact=2),
        },
        max_per_club=2,
        locked_player_ids=set(),
        banned_player_ids=set(),
    )

    result = optimize_lineup(candidates=candidates, constraints=constraints)
    selected = [player for player in candidates if player.id in result["selected_player_ids"]]

    football_count = sum(1 for player in selected if player.sport == "football")
    basketball_count = sum(1 for player in selected if player.sport == "basketball")

    assert football_count == 2
    assert basketball_count == 2

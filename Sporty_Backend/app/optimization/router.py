from __future__ import annotations

from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.auth.dependencies import get_current_active_user
from app.auth.models import User
from app.services.optimization.ilp_optimizer import (
    CandidatePlayer,
    LineupOptimizationError,
    OptimizerConstraints,
    PositionConstraint,
    optimize_lineup,
)


router = APIRouter(prefix="/optimization", tags=["Optimization"])


class PositionConstraintPayload(BaseModel):
    min: int = 0
    max: int | None = None
    exact: int | None = None


class CandidatePlayerPayload(BaseModel):
    id: UUID
    sport: str
    position: str
    club: str
    cost: Decimal
    projected_points: Decimal
    is_available: bool = True


class OptimizationConstraintsPayload(BaseModel):
    budget: Decimal
    squad_size: int = Field(ge=1)
    positions: dict[str, PositionConstraintPayload] = Field(default_factory=dict)
    sports: dict[str, PositionConstraintPayload] = Field(default_factory=dict)
    max_per_club: int = Field(ge=1)
    locked_player_ids: list[UUID] = Field(default_factory=list)
    banned_player_ids: list[UUID] = Field(default_factory=list)
    vice_bonus_multiplier: Decimal = Decimal("0")


class OptimizeLineupRequest(BaseModel):
    candidates: list[CandidatePlayerPayload]
    constraints: OptimizationConstraintsPayload


class OptimizeLineupResponse(BaseModel):
    selected_player_ids: list[UUID]
    captain_player_id: UUID
    vice_captain_player_id: UUID
    total_cost: Decimal
    projected_points_without_multiplier: Decimal
    projected_points_with_captain_bonus: Decimal
    solver_status: str


@router.post(
    "/lineup",
    response_model=OptimizeLineupResponse,
    summary="Optimize lineup with ILP",
)
def optimize_lineup_endpoint(
    payload: OptimizeLineupRequest,
    _current_user: User = Depends(get_current_active_user),
):
    # Algorithm: translate payload to ILP model inputs, solve lineup optimization, and return deterministic selected squad/captain/vice result.
    candidates = [
        CandidatePlayer(
            id=str(player.id),
            sport=player.sport,
            position=player.position,
            club=player.club,
            cost=player.cost,
            projected_points=player.projected_points,
            is_available=player.is_available,
        )
        for player in payload.candidates
    ]

    constraints = OptimizerConstraints(
        budget=payload.constraints.budget,
        squad_size=payload.constraints.squad_size,
        positions={
            position: PositionConstraint(min=rule.min, max=rule.max, exact=rule.exact)
            for position, rule in payload.constraints.positions.items()
        },
        sports={
            sport: PositionConstraint(min=rule.min, max=rule.max, exact=rule.exact)
            for sport, rule in payload.constraints.sports.items()
        },
        max_per_club=payload.constraints.max_per_club,
        locked_player_ids={str(pid) for pid in payload.constraints.locked_player_ids},
        banned_player_ids={str(pid) for pid in payload.constraints.banned_player_ids},
        vice_bonus_multiplier=payload.constraints.vice_bonus_multiplier,
    )

    try:
        result = optimize_lineup(candidates=candidates, constraints=constraints)
    except LineupOptimizationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    return {
        "selected_player_ids": [UUID(player_id) for player_id in result["selected_player_ids"]],
        "captain_player_id": UUID(str(result["captain_player_id"])),
        "vice_captain_player_id": UUID(str(result["vice_captain_player_id"])),
        "total_cost": result["total_cost"],
        "projected_points_without_multiplier": result["projected_points_without_multiplier"],
        "projected_points_with_captain_bonus": result["projected_points_with_captain_bonus"],
        "solver_status": result["solver_status"],
    }

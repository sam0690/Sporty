"""Dynamic player repricing service.

This module updates player costs based on recent fantasy-point form and
records every price movement in an immutable audit table.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
import uuid

from sqlalchemy.orm import Session, joinedload

from app.league.models import TransferWindow
from app.player.models import Player, PlayerGameweekStat, PlayerPriceHistory


@dataclass(frozen=True)
class PricingPolicy:
    """Per-sport pricing parameters used by the repricing algorithm."""

    min_cost: Decimal
    max_cost: Decimal
    baseline_points: Decimal
    points_to_cost_factor: Decimal
    max_step_per_run: Decimal


DEFAULT_POLICY = PricingPolicy(
    min_cost=Decimal("4.0"),
    max_cost=Decimal("20.0"),
    baseline_points=Decimal("6.0"),
    points_to_cost_factor=Decimal("0.15"),
    max_step_per_run=Decimal("1.50"),
)

SPORT_POLICIES: dict[str, PricingPolicy] = {
    "football": DEFAULT_POLICY,
    "basketball": PricingPolicy(
        min_cost=Decimal("5.0"),
        max_cost=Decimal("22.0"),
        baseline_points=Decimal("8.0"),
        points_to_cost_factor=Decimal("0.12"),
        max_step_per_run=Decimal("1.50"),
    ),
    "cricket": PricingPolicy(
        min_cost=Decimal("4.0"),
        max_cost=Decimal("20.0"),
        baseline_points=Decimal("7.0"),
        points_to_cost_factor=Decimal("0.13"),
        max_step_per_run=Decimal("1.50"),
    ),
}


def _clamp(value: Decimal, lower: Decimal, upper: Decimal) -> Decimal:
    return max(lower, min(upper, value))


def _quantize_cost(value: Decimal) -> Decimal:
    # Use 0.1 increments to keep market prices readable in UI.
    return value.quantize(Decimal("0.10"), rounding=ROUND_HALF_UP)


def _window_weights(window_ids: list[uuid.UUID]) -> dict[uuid.UUID, Decimal]:
    if not window_ids:
        return {}

    n = len(window_ids)
    denominator = Decimal(sum(range(1, n + 1)))
    weights: dict[uuid.UUID, Decimal] = {}

    # Input order is newest -> oldest; give newest the largest weight.
    for index, window_id in enumerate(window_ids):
        rank = Decimal(n - index)
        weights[window_id] = rank / denominator

    return weights


def recalculate_player_prices(
    db: Session,
    *,
    lookback_windows: int = 3,
    algorithm_version: str = "v1",
) -> dict[str, int]:
    """Recompute player costs from recent form and persist price history.

    Returns aggregate counters for observability in task logs.
    """
    if lookback_windows < 1:
        raise ValueError("lookback_windows must be >= 1")

    recent_windows = (
        db.query(TransferWindow)
        .order_by(TransferWindow.end_at.desc())
        .limit(lookback_windows)
        .all()
    )
    if not recent_windows:
        return {
            "lookback_windows": lookback_windows,
            "evaluated": 0,
            "updated": 0,
            "unchanged": 0,
        }

    window_ids = [window.id for window in recent_windows]
    latest_window_id = recent_windows[0].id
    weights = _window_weights(window_ids)

    stat_rows = (
        db.query(
            PlayerGameweekStat.player_id,
            PlayerGameweekStat.transfer_window_id,
            PlayerGameweekStat.fantasy_points,
        )
        .filter(PlayerGameweekStat.transfer_window_id.in_(window_ids))
        .all()
    )

    weighted_points_sum: dict[uuid.UUID, Decimal] = defaultdict(lambda: Decimal("0"))
    weighted_total: dict[uuid.UUID, Decimal] = defaultdict(lambda: Decimal("0"))

    for player_id, transfer_window_id, fantasy_points in stat_rows:
        weight = weights.get(transfer_window_id)
        if weight is None:
            continue
        weighted_points_sum[player_id] += fantasy_points * weight
        weighted_total[player_id] += weight

    if not weighted_points_sum:
        return {
            "lookback_windows": lookback_windows,
            "evaluated": 0,
            "updated": 0,
            "unchanged": 0,
        }

    players = (
        db.query(Player)
        .options(joinedload(Player.sport))
        .filter(Player.id.in_(list(weighted_points_sum.keys())))
        .all()
    )

    history_rows: list[PlayerPriceHistory] = []
    updated = 0
    unchanged = 0

    for player in players:
        denominator = weighted_total[player.id]
        if denominator <= 0:
            unchanged += 1
            continue

        weighted_points = weighted_points_sum[player.id] / denominator
        policy = SPORT_POLICIES.get(player.sport.name, DEFAULT_POLICY)

        raw_delta = (
            (weighted_points - policy.baseline_points) * policy.points_to_cost_factor
        )
        bounded_delta = _clamp(
            raw_delta,
            -policy.max_step_per_run,
            policy.max_step_per_run,
        )

        next_cost = _quantize_cost(
            _clamp(player.cost + bounded_delta, policy.min_cost, policy.max_cost)
        )

        if next_cost == player.cost:
            unchanged += 1
            continue

        delta = next_cost - player.cost
        history_rows.append(
            PlayerPriceHistory(
                player_id=player.id,
                transfer_window_id=latest_window_id,
                old_cost=player.cost,
                new_cost=next_cost,
                delta=delta,
                weighted_points=weighted_points.quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                ),
                algorithm_version=algorithm_version,
            )
        )
        player.cost = next_cost
        updated += 1

    if history_rows:
        db.add_all(history_rows)

    db.commit()

    return {
        "lookback_windows": lookback_windows,
        "evaluated": len(players),
        "updated": updated,
        "unchanged": unchanged,
    }

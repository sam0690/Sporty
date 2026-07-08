"""Per-player forward point "projection" — v1 is an honest recency-weighted
average, not a trained/predictive model. No opponent adjustment, no
injury/availability signal, no minutes-played projection. Uses the same
triangular recency-weighting shape as app/services/pricing/repricing.py's
_window_weights (duplicated here rather than imported — that helper is
module-private to repricing's own pricing algorithm, not a shared utility).
"""
from __future__ import annotations

import uuid
from collections import defaultdict
from decimal import Decimal

from sqlalchemy.orm import Session

from app.league.models import TransferWindow
from app.player.models import PlayerGameweekStat

DEFAULT_LOOKBACK_WINDOWS = 3


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


def compute_projected_points(
    db: Session,
    player_ids: list[uuid.UUID],
    *,
    lookback_windows: int = DEFAULT_LOOKBACK_WINDOWS,
) -> dict[uuid.UUID, Decimal]:
    """Weighted average of each player's fantasy_points over the last
    `lookback_windows` transfer windows (most recent weighted highest).
    Players with no stats in that range are simply absent from the result —
    callers should treat a missing id as "no data" (fall back to 0), same
    convention as trade_service._player_value_map.
    """
    if not player_ids:
        return {}

    recent_windows = (
        db.query(TransferWindow)
        .order_by(TransferWindow.end_at.desc())
        .limit(lookback_windows)
        .all()
    )
    if not recent_windows:
        return {}

    window_ids = [w.id for w in recent_windows]
    weights = _window_weights(window_ids)

    stat_rows = (
        db.query(
            PlayerGameweekStat.player_id,
            PlayerGameweekStat.transfer_window_id,
            PlayerGameweekStat.fantasy_points,
        )
        .filter(
            PlayerGameweekStat.player_id.in_(player_ids),
            PlayerGameweekStat.transfer_window_id.in_(window_ids),
        )
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

    return {
        player_id: weighted_points_sum[player_id] / weighted_total[player_id]
        for player_id in weighted_points_sum
        if weighted_total[player_id] > 0
    }

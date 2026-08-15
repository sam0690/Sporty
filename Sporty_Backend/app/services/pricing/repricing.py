"""Dynamic player repricing service.

This module updates player costs based on recent fantasy-point form and
records every price movement in an immutable audit table.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
import uuid

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.league.models import Season, Transfer, TransferWindow
from app.player import read_cache as player_read_cache
from app.player.models import Player, PlayerGameweekStat, PlayerPriceHistory


@dataclass(frozen=True)
class PricingPolicy:
    """Per-sport pricing parameters used by the repricing algorithm.

    Blends two signals into one bounded per-run delta: recent-form
    performance (weighted_points vs baseline) and net-transfer demand.
    Both are scaled into cost-delta terms before weighting, so
    performance_weight/demand_weight are a genuine 0..1 blend rather than
    two differently-scaled quantities being added together.
    """

    min_cost: Decimal
    max_cost: Decimal
    baseline_points: Decimal
    points_to_cost_factor: Decimal
    max_step_per_run: Decimal
    performance_weight: Decimal = Decimal("0.70")
    demand_weight: Decimal = Decimal("0.30")


DEFAULT_POLICY = PricingPolicy(
    min_cost=Decimal("4.0"),
    max_cost=Decimal("17.0"),
    baseline_points=Decimal("6.0"),
    points_to_cost_factor=Decimal("0.15"),
    max_step_per_run=Decimal("1.50"),
)

SPORT_POLICIES: dict[str, PricingPolicy] = {
    "football": DEFAULT_POLICY,
    "basketball": PricingPolicy(
        min_cost=Decimal("5.0"),
        max_cost=Decimal("20.0"),
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


# A player may drift at most this far from their anchor_cost (the price they
# were seeded at for the season). The per-run step is already bounded, but a
# sustained above-baseline signal used to walk price to max_cost one step at a
# time — that is what pinned 165 football players at the 17.0 ceiling in
# 2026-07. Bounding total drift makes the runaway structurally impossible
# rather than merely unlikely, so a wrong input produces a wrong-but-stable
# price instead of a ceiling pile-up. Ignored for players with no anchor.
MAX_DRIFT_FROM_ANCHOR = Decimal("3.0")

# Defensive backstop on stat rows. A single gameweek cannot plausibly produce
# these; values beyond them mean season aggregates have been written into a
# gameweek row, which is exactly how the 2026-07 incident started (the CSV
# importer's dataset-import seasons carried 120-minute, 144-point rows).
# The active-season filter below is the real fix — this only stops a
# malformed row inside a legitimate window from being priced in.
MAX_PLAUSIBLE_GAMEWEEK_MINUTES = 120
MAX_PLAUSIBLE_GAMEWEEK_POINTS = Decimal("60")


def _clamp(value: Decimal, lower: Decimal, upper: Decimal) -> Decimal:
    return max(lower, min(upper, value))


def _quantize_cost(value: Decimal) -> Decimal:
    # Use 0.1 increments to keep market prices readable in UI.
    return value.quantize(Decimal("0.10"), rounding=ROUND_HALF_UP)


def _is_plausible_gameweek(
    fantasy_points: Decimal | None, minutes_played: int | None
) -> bool:
    """Reject stat rows that can only be season aggregates, not one gameweek."""
    if fantasy_points is None:
        return False
    if abs(fantasy_points) > MAX_PLAUSIBLE_GAMEWEEK_POINTS:
        return False
    if minutes_played is not None and minutes_played > MAX_PLAUSIBLE_GAMEWEEK_MINUTES:
        return False
    return True


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


def _demand_counts(
    db: Session, window_ids: list[uuid.UUID]
) -> dict[uuid.UUID, tuple[int, int]]:
    """Net transfers in/out per player over the given windows."""
    in_rows = (
        db.query(Transfer.player_in_id, func.count(Transfer.id))
        .filter(Transfer.transfer_window_id.in_(window_ids))
        .group_by(Transfer.player_in_id)
        .all()
    )
    out_rows = (
        db.query(Transfer.player_out_id, func.count(Transfer.id))
        .filter(Transfer.transfer_window_id.in_(window_ids))
        .group_by(Transfer.player_out_id)
        .all()
    )

    counts: dict[uuid.UUID, list[int]] = defaultdict(lambda: [0, 0])
    for player_id, count in in_rows:
        counts[player_id][0] += count
    for player_id, count in out_rows:
        counts[player_id][1] += count

    return {player_id: (in_count, out_count) for player_id, (in_count, out_count) in counts.items()}


def recalculate_player_prices(
    db: Session,
    *,
    lookback_windows: int = 3,
    algorithm_version: str = "v2",
) -> dict[str, int]:
    """Recompute player costs from recent form and persist price history.

    Returns aggregate counters for observability in task logs.
    """
    if lookback_windows < 1:
        raise ValueError("lookback_windows must be >= 1")

    # Only windows belonging to an ACTIVE season count. Without this join the
    # query is "the N windows with the greatest end_at", which the CSV
    # importer's synthetic dataset-import seasons win permanently — their
    # windows are dated 2099/2100, so they sorted to the top on every run and
    # real gameweeks were never seen. See scripts/purge_dataset_import_stats.py.
    recent_windows = (
        db.query(TransferWindow)
        .join(Season, Season.id == TransferWindow.season_id)
        .filter(Season.is_active.is_(True))
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
    demand_counts = _demand_counts(db, window_ids)

    stat_rows = (
        db.query(
            PlayerGameweekStat.player_id,
            PlayerGameweekStat.transfer_window_id,
            PlayerGameweekStat.fantasy_points,
            PlayerGameweekStat.minutes_played,
        )
        .filter(PlayerGameweekStat.transfer_window_id.in_(window_ids))
        .all()
    )

    weighted_points_sum: dict[uuid.UUID, Decimal] = defaultdict(lambda: Decimal("0"))
    weighted_total: dict[uuid.UUID, Decimal] = defaultdict(lambda: Decimal("0"))

    for player_id, transfer_window_id, fantasy_points, minutes_played in stat_rows:
        weight = weights.get(transfer_window_id)
        if weight is None:
            continue
        if not _is_plausible_gameweek(fantasy_points, minutes_played):
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

    # This task runs on a daily cron, but a transfer window's underlying
    # stats/demand often don't change day to day. Without this guard, a
    # positive delta gets recomputed and reapplied every single run against
    # the same unchanged signal, marching price to max_cost within days even
    # with zero new results — this is exactly what happened to ~27% of the
    # football pool. Skip a player only once BOTH signals (weighted_points
    # and demand_score) match the last run's for this window, so a change in
    # either one still moves price — only a fully-unchanged run is a no-op.
    last_priced_signals: dict[uuid.UUID, tuple[Decimal, Decimal | None]] = {}
    for player_id, points, demand in (
        db.query(
            PlayerPriceHistory.player_id,
            PlayerPriceHistory.weighted_points,
            PlayerPriceHistory.demand_score,
        )
        .filter(
            PlayerPriceHistory.transfer_window_id == latest_window_id,
            PlayerPriceHistory.player_id.in_(list(weighted_points_sum.keys())),
        )
        .order_by(PlayerPriceHistory.created_at.desc())
        .all()
    ):
        last_priced_signals.setdefault(player_id, (points, demand))

    history_rows: list[PlayerPriceHistory] = []
    updated = 0
    unchanged = 0

    for player in players:
        denominator = weighted_total[player.id]
        if denominator <= 0:
            unchanged += 1
            continue

        weighted_points = weighted_points_sum[player.id] / denominator
        quantized_points = weighted_points.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        in_count, out_count = demand_counts.get(player.id, (0, 0))
        transfer_volume = max(1, in_count + out_count)
        demand_score = Decimal(in_count - out_count) / Decimal(transfer_volume)
        quantized_demand = demand_score.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

        if last_priced_signals.get(player.id) == (quantized_points, quantized_demand):
            unchanged += 1
            continue

        policy = SPORT_POLICIES.get(player.sport.name, DEFAULT_POLICY)

        performance_delta = (
            (weighted_points - policy.baseline_points) * policy.points_to_cost_factor
        )

        # Scaled the same way performance_delta ultimately gets bounded, so a
        # maximal demand skew alone can move price by up to max_step_per_run
        # before weighting — the two signals are comparably scaled inputs to
        # the blend rather than differently-sized quantities being summed.
        demand_delta = demand_score * policy.max_step_per_run

        raw_delta = (
            (performance_delta * policy.performance_weight)
            + (demand_delta * policy.demand_weight)
        )
        bounded_delta = _clamp(
            raw_delta,
            -policy.max_step_per_run,
            policy.max_step_per_run,
        )

        lower_bound = policy.min_cost
        upper_bound = policy.max_cost
        if player.anchor_cost is not None:
            # Bound total drift, not just the per-run step. Without this a
            # sustained above-baseline signal reaches max_cost by repetition.
            lower_bound = max(lower_bound, player.anchor_cost - MAX_DRIFT_FROM_ANCHOR)
            upper_bound = min(upper_bound, player.anchor_cost + MAX_DRIFT_FROM_ANCHOR)

        next_cost = _quantize_cost(
            _clamp(player.cost + bounded_delta, lower_bound, upper_bound)
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
                weighted_points=quantized_points,
                demand_score=quantized_demand,
                algorithm_version=algorithm_version,
            )
        )
        player.cost = next_cost
        updated += 1

    if history_rows:
        db.add_all(history_rows)

    db.commit()

    # New prices are live — drop the cached player lists/details/price history
    # so the market shows them now rather than after the TTL.
    player_read_cache.bust_all()

    return {
        "lookback_windows": lookback_windows,
        "evaluated": len(players),
        "updated": updated,
        "unchanged": unchanged,
    }

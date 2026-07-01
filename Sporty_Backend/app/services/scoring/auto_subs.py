"""Formation-aware automatic substitutions — pure, DB-free logic.

When a starter plays 0 minutes, the highest-priority bench player who *did*
play is substituted in, but only if the resulting XI still satisfies the
league's position min/max rules (``LineupSlot``). This keeps the special cases
correct for free:

  * A goalkeeper who didn't play can only be replaced by a bench goalkeeper,
    because subbing an outfielder in would push GKP below its min (and the
    outfield position above its max).
  * A defender can only be subbed off if the resulting XI still has at least
    the minimum number of defenders.

Positions are keyed by ``(sport_id, POSITION)`` so the same routine works for
single-sport and mixed leagues; a position with no matching slot is treated as
unconstrained. The function is intentionally pure (operates on plain
dataclasses) so it can be unit-tested without a database.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Hashable


@dataclass(frozen=True)
class LineupPlayer:
    """A single lineup entry as the auto-sub engine sees it."""

    player_id: Hashable
    position_key: Hashable  # e.g. (sport_id, "DEF"); None => unconstrained
    minutes_played: int
    points: Decimal
    # Bench priority (0 = first to come on). None for starters.
    bench_order: int | None = None

    @property
    def played(self) -> bool:
        return self.minutes_played > 0


@dataclass
class SubResult:
    """Outcome of resolving a team's effective XI for a gameweek."""

    effective_ids: set[Hashable] = field(default_factory=set)
    # starter player_id -> bench player_id that replaced them
    subbed_out: dict[Hashable, Hashable] = field(default_factory=dict)
    subbed_in: dict[Hashable, Hashable] = field(default_factory=dict)
    base_points: Decimal = Decimal("0")


def _counts(players: list[LineupPlayer]) -> dict[Hashable, int]:
    counts: dict[Hashable, int] = {}
    for p in players:
        if p.position_key is None:
            continue
        counts[p.position_key] = counts.get(p.position_key, 0) + 1
    return counts


def _within_bounds(
    counts: dict[Hashable, int],
    slot_bounds: dict[Hashable, tuple[int, int]],
) -> bool:
    """True if every constrained position count is within [min, max]."""
    for key, (lo, hi) in slot_bounds.items():
        c = counts.get(key, 0)
        if c < lo or c > hi:
            return False
    return True


def resolve_effective_lineup(
    starters: list[LineupPlayer],
    bench: list[LineupPlayer],
    slot_bounds: dict[Hashable, tuple[int, int]],
) -> SubResult:
    """Compute the effective scoring XI after FPL-style auto-substitutions.

    Args:
        starters: the starting players (any order).
        bench: bench players ordered by priority (index 0 = first sub on). Only
            bench players who actually played are eligible to come on.
        slot_bounds: ``position_key -> (min_count, max_count)``. Positions absent
            from this map are unconstrained. Pass ``{}`` for no formation rules
            (every non-playing starter is then replaced in bench order).

    Returns:
        A ``SubResult`` with the effective player ids, the sub mapping, and the
        summed base points of the effective XI.
    """
    # Current XI membership by player_id -> LineupPlayer.
    current: dict[Hashable, LineupPlayer] = {p.player_id: p for p in starters}
    result = SubResult()

    non_players = [p for p in starters if not p.played]
    # Bench candidates: played, in the given priority order.
    available = [p for p in bench if p.played]

    for out_player in non_players:
        if not available:
            break
        chosen_idx: int | None = None
        for idx, cand in enumerate(available):
            # Try the swap and re-check formation validity.
            trial = [
                p for pid, p in current.items() if pid != out_player.player_id
            ]
            trial.append(cand)
            if _within_bounds(_counts(trial), slot_bounds):
                chosen_idx = idx
                break
        if chosen_idx is None:
            # No bench player can legally replace this starter — they stay
            # in the XI and score their (zero) points.
            continue
        cand = available.pop(chosen_idx)
        del current[out_player.player_id]
        current[cand.player_id] = cand
        result.subbed_out[out_player.player_id] = cand.player_id
        result.subbed_in[cand.player_id] = out_player.player_id

    result.effective_ids = set(current.keys())
    result.base_points = sum(
        (p.points for p in current.values()), Decimal("0")
    )
    return result

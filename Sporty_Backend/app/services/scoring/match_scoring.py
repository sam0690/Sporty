"""Per-match football scoring — the source of truth for football performance.

Each finished match books ONE PlayerMatchScore per player: the match's metric
snapshot (JSONB) + the engine's fantasy_points/breakdown over it. That gives
per-match explainability and rule-change recalc (re-score from stored stats, no
re-fetch), and it fixes the old bug where a second match in one gameweek window
overwrote the first.

Windows are ranges over these rows, never storage keys — a match is booked once
no matter how many schedules (EPL/LaLiga/Bundesliga/combined) cover its date.
The window-level PlayerGameweekStat is a rollup written by
player_scoring.score_football_players_for_window, which aggregates the matches
window_locator.matches_in_window puts inside each window.
"""
from __future__ import annotations

import uuid
from collections import defaultdict
from decimal import Decimal
from typing import NamedTuple

from sqlalchemy.orm import Session

from app.scoring.models import PlayerMatchScore
from app.services.scoring.football_engine import Rule, compute_bps, compute_football_score
from app.services.scoring.window_locator import matches_in_window


def upsert_player_match_score(
    db: Session,
    *,
    player_id: uuid.UUID,
    match_id: uuid.UUID,
    position: str | None,
    minutes: int,
    stats: dict,
    rules: list[Rule],
) -> PlayerMatchScore:
    """Compute and upsert one player's score for one match. Idempotent per
    (player, match): the stats snapshot and score are assigned (not added), so
    re-booking the same match converges."""
    total, breakdown = compute_football_score(position, stats, rules)
    row = (
        db.query(PlayerMatchScore)
        .filter(
            PlayerMatchScore.player_id == player_id,
            PlayerMatchScore.match_id == match_id,
        )
        .first()
    )
    if row is None:
        row = PlayerMatchScore(player_id=player_id, match_id=match_id)
        db.add(row)
    row.position = position
    row.minutes = int(stats.get("minutes", 0) or 0)
    row.stats = stats
    row.fantasy_points = total
    row.breakdown = breakdown
    row.bps = compute_bps(position, stats)
    db.flush()
    return row


def award_match_bonus(db: Session, *, match_id: uuid.UUID) -> None:
    """Award the 3/2/1 bonus points to a match's top performers by BPS.

    Ranks by DISTINCT bps value (FPL tie handling): everyone at the top value
    gets 3, everyone at the 2nd-highest gets 2, 3rd-highest gets 1. One row per
    player per match, so each player is ranked once. Idempotent — recomputed in
    full each call.
    """
    rows = db.query(PlayerMatchScore).filter(PlayerMatchScore.match_id == match_id).all()
    if not rows:
        return
    bps_by_player = {r.player_id: r.bps for r in rows}
    ranked_values = sorted({v for v in bps_by_player.values() if v > 0}, reverse=True)
    award_for_value = {val: Decimal(3 - i) for i, val in enumerate(ranked_values[:3])}
    for r in rows:
        r.bonus_points = award_for_value.get(bps_by_player[r.player_id], Decimal("0"))
    db.flush()


class WindowAggregate(NamedTuple):
    """One player's gameweek rollup, summed from their matches in the window."""

    total: Decimal
    breakdown: list[dict]
    minutes: int
    stats: dict


def _sum_match_stats(matches: list[PlayerMatchScore]) -> dict:
    """Add up the metric snapshots of a player's matches in one window.

    Counting metrics sum; `rating` is a 0-10 score, so it averages instead
    (summing two 7.0s into 14.0 would be nonsense on the profile).
    """
    summed: dict = defaultdict(int)
    ratings = []
    for m in matches:
        for key, value in (m.stats or {}).items():
            if key == "rating":
                if value is not None:
                    ratings.append(Decimal(str(value)))
            elif isinstance(value, (int, float)):
                summed[key] += int(value)
    out = dict(summed)
    if ratings:
        out["rating"] = sum(ratings) / len(ratings)
    return out


def rescore_window_match_scores(
    db: Session,
    *,
    window,
    rules: list[Rule],
) -> dict[uuid.UUID, WindowAggregate]:
    """Re-run the engine over every match score inside `window` (picks up rule
    changes without re-fetching stats), update each match row, and return the
    per-player gameweek rollup.

    The window's matches come from window_locator.matches_in_window — its date
    range plus its schedule's competition scope — so a per-competition window
    sums only its own competition's matches and the combined window sums them
    all, off ONE stored row per (player, match).

    total includes each match's bonus_points (set by the BPS pass); breakdown
    concatenates the matches' breakdowns; minutes and stats sum the matches, so
    a double gameweek adds up instead of overwriting.
    """
    match_ids = matches_in_window(db, window)
    if not match_ids:
        return {}

    rows = (
        db.query(PlayerMatchScore)
        .filter(PlayerMatchScore.match_id.in_(match_ids))
        .all()
    )
    agg: dict[uuid.UUID, WindowAggregate] = {}
    per_player: dict[uuid.UUID, list[PlayerMatchScore]] = defaultdict(list)
    for row in rows:
        total, breakdown = compute_football_score(row.position, row.stats or {}, rules)
        row.fantasy_points = total
        row.breakdown = breakdown
        per_player[row.player_id].append(row)
    if rows:
        db.flush()
    for player_id, matches in per_player.items():
        total = sum((m.fantasy_points + m.bonus_points for m in matches), Decimal("0"))
        merged: list[dict] = []
        for m in matches:
            merged.extend(m.breakdown or [])
            if m.bonus_points:
                merged.append({"action": "bonus", "count": 1,
                               "subtotal": float(m.bonus_points), "match_id": str(m.match_id)})
        agg[player_id] = WindowAggregate(
            total=total,
            breakdown=merged,
            minutes=sum(m.minutes for m in matches),
            stats=_sum_match_stats(matches),
        )
    return agg

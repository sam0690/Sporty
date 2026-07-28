"""Per-match football scoring (Phase 2).

Each finished match books a PlayerMatchScore per player: the match's metric
snapshot (JSONB) + the engine's fantasy_points/breakdown over it. A player's
window total is the SUM of their match scores — which fixes the old bug where a
second match in one gameweek window overwrote the first, and gives per-match
explainability + rule-change recalc (re-score from stored stats, no re-fetch).

The window-level PlayerGameweekStat.fantasy_points is written by
player_scoring.score_football_players_for_window, which aggregates these.
"""
from __future__ import annotations

import uuid
from collections import defaultdict
from decimal import Decimal

from sqlalchemy.orm import Session

from app.scoring.models import PlayerMatchScore
from app.services.scoring.football_engine import Rule, compute_bps, compute_football_score


def upsert_player_match_score(
    db: Session,
    *,
    player_id: uuid.UUID,
    match_id: uuid.UUID,
    transfer_window_id: uuid.UUID,
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
            PlayerMatchScore.transfer_window_id == transfer_window_id,
        )
        .first()
    )
    if row is None:
        row = PlayerMatchScore(
            player_id=player_id, match_id=match_id,
            transfer_window_id=transfer_window_id,
        )
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
    gets 3, everyone at the 2nd-highest gets 2, 3rd-highest gets 1. A player's
    bps is identical across their per-window rows, so all their rows for this
    match get the same bonus. Idempotent — recomputed in full each call.
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


def rescore_window_match_scores(
    db: Session,
    *,
    transfer_window_id: uuid.UUID,
    rules: list[Rule],
) -> dict[uuid.UUID, tuple[Decimal, list[dict]]]:
    """Re-run the engine over every stored PlayerMatchScore in a window (picks
    up rule changes without re-fetching stats), update each match row, and
    return per-player aggregates {player_id: (window_total, merged_breakdown)}.

    window_total includes each match's bonus_points (set by the Phase 4 BPS
    pass); merged_breakdown concatenates the matches' breakdowns.
    """
    rows = (
        db.query(PlayerMatchScore)
        .filter(PlayerMatchScore.transfer_window_id == transfer_window_id)
        .all()
    )
    agg: dict[uuid.UUID, tuple[Decimal, list[dict]]] = {}
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
        agg[player_id] = (total, merged)
    return agg

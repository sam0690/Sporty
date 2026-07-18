"""Power rankings — read-only reporting layer on top of TeamWeeklyScore.

Computes week-over-week rank movement, a simple "hot streak" badge, and a
"Manager of the Week" flag. Nothing here is persisted — it's derived fresh
from TeamWeeklyScore.rank_in_league/points each call, same way the league
leaderboard is. See app/services/scoring/ranking.py for how rank_in_league
itself gets computed (SQL RANK() per window).
"""
from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.league.models import FantasyTeam, PointsPenalty, TeamWeeklyScore, TransferWindow

# A team counts as "hot" while it stays inside the top N ranks; the streak
# badge is how many *consecutive* most-recent windows it's stayed there.
STREAK_TOP_N_RANK = 3
STREAK_MIN_TO_SHOW = 2


def get_power_rankings(db: Session, league_id: uuid.UUID) -> list[dict]:
    rows = (
        db.query(
            TeamWeeklyScore.fantasy_team_id,
            TeamWeeklyScore.rank_in_league,
            TeamWeeklyScore.points,
            TeamWeeklyScore.transfer_window_id,
            TransferWindow.number,
        )
        .join(FantasyTeam, FantasyTeam.id == TeamWeeklyScore.fantasy_team_id)
        .join(TransferWindow, TransferWindow.id == TeamWeeklyScore.transfer_window_id)
        .filter(
            FantasyTeam.league_id == league_id,
            TeamWeeklyScore.rank_in_league.isnot(None),
        )
        .order_by(TransferWindow.number.asc())
        .all()
    )

    if not rows:
        return []

    # Net budget-overage penalties same as get_dashboard_stats — rank_in_league
    # is already penalty-net (ranking.py), but raw TeamWeeklyScore.points isn't,
    # so the points shown here disagreed with the rank right next to them.
    penalty_by_key: dict[tuple[uuid.UUID, uuid.UUID], Decimal] = {
        (fid, wid): charged
        for fid, wid, charged in (
            db.query(
                PointsPenalty.fantasy_team_id,
                PointsPenalty.transfer_window_id,
                func.sum(PointsPenalty.points_charged),
            )
            .join(FantasyTeam, FantasyTeam.id == PointsPenalty.fantasy_team_id)
            .filter(FantasyTeam.league_id == league_id)
            .group_by(PointsPenalty.fantasy_team_id, PointsPenalty.transfer_window_id)
            .all()
        )
    }

    by_team: dict[uuid.UUID, list[tuple[int, int, Decimal]]] = {}
    latest_window_number = 0
    for team_id, rank, points, window_id, window_number in rows:
        deducted = penalty_by_key.get((team_id, window_id), Decimal("0"))
        by_team.setdefault(team_id, []).append((window_number, rank, points - deducted))
        latest_window_number = max(latest_window_number, window_number)

    team_names = {
        t.id: t.name
        for t in db.query(FantasyTeam).filter(FantasyTeam.league_id == league_id)
    }

    results: list[dict] = []
    for team_id, history in by_team.items():
        history.sort(key=lambda row: row[0])  # by window_number ascending
        current_window_number, current_rank, current_points = history[-1]
        if current_window_number != latest_window_number:
            # This team has no score for the latest window (e.g. joined mid-season
            # eligibility gap) — skip it from this window's rankings entirely
            # rather than showing stale data.
            continue

        previous_rank = history[-2][1] if len(history) >= 2 else None
        rank_delta = (previous_rank - current_rank) if previous_rank is not None else None

        streak = 0
        for _, rank, _ in reversed(history):
            if rank <= STREAK_TOP_N_RANK:
                streak += 1
            else:
                break

        results.append(
            {
                "fantasy_team_id": str(team_id),
                "team_name": team_names.get(team_id, ""),
                "rank": current_rank,
                "points": float(current_points),
                "rank_delta": rank_delta,
                "streak": streak if streak >= STREAK_MIN_TO_SHOW else 0,
                "manager_of_the_week": False,
            }
        )

    results.sort(key=lambda r: r["rank"])
    if results:
        top_points = max(r["points"] for r in results)
        for r in results:
            if r["points"] == top_points:
                r["manager_of_the_week"] = True

    return results

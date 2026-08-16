"""Predictor game logic — scoring rubric, resolution, leaderboard, CRUD.

Transaction ownership: the router-facing entry points here own their commit
(create/update); resolve_predictions_for_match is called from the match-finish
paths (football_live_sync._finish_match, and feed.py when the feeder is on),
which own their transaction, so this helper flushes and lets the caller commit.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.auth.models import User
from app.league.models import LeagueMembership, LeagueMembershipStatus
from app.match.models import Match
from app.prediction.models import PredictionEntry
from app.prediction.schemas import (
    LeaderboardResponse,
    LeaderboardRow,
    PredictionResponse,
)

# Tiered rubric (5/3/1/0). One dict so it's tunable without a migration.
POINTS_EXACT = 5
POINTS_RESULT_AND_GD = 3
POINTS_RESULT = 1
POINTS_WRONG = 0


def score_prediction(
    pred_home: int, pred_away: int, actual_home: int, actual_away: int
) -> int:
    """Points for one prediction vs the final score, tiered 5/3/1/0.

    exact score = 5; correct result + goal difference = 3;
    correct result only = 1; wrong result = 0.
    """
    if pred_home == actual_home and pred_away == actual_away:
        return POINTS_EXACT

    def result(h: int, a: int) -> int:
        return (h > a) - (h < a)  # 1 home win, -1 away win, 0 draw

    if result(pred_home, pred_away) != result(actual_home, actual_away):
        return POINTS_WRONG
    # Correct result from here. Goal difference match bumps to the middle tier.
    if (pred_home - pred_away) == (actual_home - actual_away):
        return POINTS_RESULT_AND_GD
    return POINTS_RESULT


def resolve_predictions_for_match(db: Session, match: Match) -> int:
    """Score every not-yet-resolved prediction for a finished match.

    Idempotent: only touches rows with points_awarded IS NULL, so re-running on
    every "finished" feeder push (feed.py re-runs the finish block each time) is
    a safe no-op. Does NOT commit — the caller owns the transaction.
    """
    if match.home_score is None or match.away_score is None:
        return 0

    pending = (
        db.query(PredictionEntry)
        .filter(
            PredictionEntry.match_id == match.id,
            PredictionEntry.points_awarded.is_(None),
        )
        .all()
    )
    for entry in pending:
        entry.points_awarded = score_prediction(
            entry.predicted_home,
            entry.predicted_away,
            match.home_score,
            match.away_score,
        )
    db.flush()
    return len(pending)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _is_locked(match: Match) -> bool:
    """Predictions lock at kickoff (or once the match is no longer scheduled)."""
    return match.status != "scheduled" or match.match_date <= _now()


def _to_response(entry: PredictionEntry, match: Match) -> PredictionResponse:
    return PredictionResponse(
        id=entry.id,
        match_id=entry.match_id,
        predicted_home=entry.predicted_home,
        predicted_away=entry.predicted_away,
        points_awarded=entry.points_awarded,
        home_team=match.home_team,
        away_team=match.away_team,
        match_date=match.match_date,
        match_status=match.status,
        home_score=match.home_score,
        away_score=match.away_score,
        locked=_is_locked(match),
    )


def upsert_prediction(
    db: Session, user_id: uuid.UUID, match_id: uuid.UUID, home: int, away: int
) -> PredictionResponse:
    """Create or update a user's prediction; rejected once kickoff has passed.

    MVP is football-only: reject predictions on non-football fixtures at the
    boundary rather than silently accepting a game we don't score for.
    """
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="Fixture not found")
    if match.sport.name != "football":
        raise HTTPException(
            status_code=422, detail="Predictions are football-only for now"
        )
    if _is_locked(match):
        raise HTTPException(
            status_code=409, detail="Predictions are locked once the match kicks off"
        )

    entry = (
        db.query(PredictionEntry)
        .filter(
            PredictionEntry.user_id == user_id,
            PredictionEntry.match_id == match_id,
        )
        .first()
    )
    if entry:
        entry.predicted_home = home
        entry.predicted_away = away
    else:
        entry = PredictionEntry(
            user_id=user_id,
            match_id=match_id,
            predicted_home=home,
            predicted_away=away,
        )
        db.add(entry)
    db.commit()
    db.refresh(entry)
    return _to_response(entry, match)


def list_my_predictions(
    db: Session, user_id: uuid.UUID, resolved: bool | None = None
) -> list[PredictionResponse]:
    """A user's predictions, newest fixture first. resolved filters by whether
    points have been awarded yet (None = all)."""
    q = (
        db.query(PredictionEntry, Match)
        .join(Match, PredictionEntry.match_id == Match.id)
        .filter(PredictionEntry.user_id == user_id)
    )
    if resolved is True:
        q = q.filter(PredictionEntry.points_awarded.isnot(None))
    elif resolved is False:
        q = q.filter(PredictionEntry.points_awarded.is_(None))
    rows = q.order_by(Match.match_date.desc()).all()
    return [_to_response(entry, match) for entry, match in rows]


def get_my_prediction_for_match(
    db: Session, user_id: uuid.UUID, match_id: uuid.UUID
) -> PredictionResponse | None:
    row = (
        db.query(PredictionEntry, Match)
        .join(Match, PredictionEntry.match_id == Match.id)
        .filter(
            PredictionEntry.user_id == user_id,
            PredictionEntry.match_id == match_id,
        )
        .first()
    )
    return _to_response(row[0], row[1]) if row else None


def get_leaderboard(
    db: Session,
    league_id: uuid.UUID | None = None,
    current_user_id: uuid.UUID | None = None,
    limit: int = 100,
) -> LeaderboardResponse:
    """SUM(points) leaderboard over resolved predictions, ranked desc.

    Global by default; pass league_id to restrict to that league's active
    members. Deliberately NOT built on the fantasy standings machinery — this
    is a plain aggregate over prediction_entries.
    """
    exact_case = case((PredictionEntry.points_awarded == POINTS_EXACT, 1), else_=0)
    base = (
        db.query(
            User.id.label("user_id"),
            User.username.label("username"),
            func.coalesce(func.sum(PredictionEntry.points_awarded), 0).label("total_points"),
            func.count(PredictionEntry.id).label("predictions_made"),
            func.coalesce(func.sum(exact_case), 0).label("exact_scores"),
        )
        .join(User, PredictionEntry.user_id == User.id)
        .filter(PredictionEntry.points_awarded.isnot(None))
        .group_by(User.id, User.username)
    )

    if league_id is not None:
        member_ids = (
            db.query(LeagueMembership.user_id)
            .filter(
                LeagueMembership.league_id == league_id,
                LeagueMembership.status == LeagueMembershipStatus.ACTIVE,
            )
            .subquery()
        )
        base = base.filter(PredictionEntry.user_id.in_(member_ids))

    # Rank the full result client-side (small table); slice for the payload.
    ranked = base.order_by(func.sum(PredictionEntry.points_awarded).desc()).all()
    rows = [
        LeaderboardRow(
            user_id=r.user_id,
            username=r.username,
            total_points=int(r.total_points),
            predictions_made=int(r.predictions_made),
            exact_scores=int(r.exact_scores),
            rank=i + 1,
        )
        for i, r in enumerate(ranked)
    ]
    me = next((row for row in rows if row.user_id == current_user_id), None)
    return LeaderboardResponse(items=rows[:limit], total=len(rows), me=me)

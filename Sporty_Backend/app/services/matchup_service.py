"""Head-to-head weekly matchups — for leagues with League.is_head_to_head=True.

Each transfer window ("gameweek") a team is paired against one opponent; the
team with more fantasy points that window records a win. Standings rank by
win record with points-for as the tiebreaker. Regular-season only (no
playoffs) — see docs/HEAD_TO_HEAD_MATCHUPS.md for the full design writeup.

The schedule is generated exactly once, when a league transitions to ACTIVE,
and never regenerated afterward — is_head_to_head and allow_midseason_join
are mutually exclusive (enforced in app/league/services.py), so the team
list is stable for the life of the schedule.

Services never commit — the router / job owns the transaction.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Session, joinedload

from app.auth.models import User
from app.league.models import (
    FantasyTeam,
    FantasyTeamStatus,
    League,
    LeagueMatchup,
    TeamWeeklyScore,
    TransferWindow,
)
from app.league.services import _require_league, _require_membership


def generate_round_robin_rounds(
    team_ids: list[uuid.UUID],
) -> list[list[tuple[uuid.UUID | None, uuid.UUID | None]]]:
    """Circle-method round robin. Returns one list of (home, away) pairs per
    round; every team plays every other team exactly once across all rounds.

    Odd team counts are padded with a `None` bye slot — whichever team is
    paired with `None` in a round has a bye that round.
    """
    teams: list[uuid.UUID | None] = list(team_ids)
    if len(teams) % 2 == 1:
        teams.append(None)

    n = len(teams)
    if n < 2:
        return []

    rounds: list[list[tuple[uuid.UUID | None, uuid.UUID | None]]] = []
    fixed, rotating = teams[0], teams[1:]

    for _ in range(n - 1):
        round_teams = [fixed] + rotating
        pairs = [
            (round_teams[i], round_teams[n - 1 - i]) for i in range(n // 2)
        ]
        rounds.append(pairs)
        rotating = [rotating[-1]] + rotating[:-1]

    return rounds


def generate_matchups_for_league(db: Session, league: League) -> None:
    """Generate the full-season matchup schedule for a head-to-head league.
    Idempotent — a no-op if matchups already exist for this league (the
    schedule is generated once, at ACTIVE transition, and never touched
    again)."""
    if db.query(LeagueMatchup).filter(LeagueMatchup.league_id == league.id).first():
        return

    windows = (
        db.query(TransferWindow)
        .filter(TransferWindow.season_id == league.season_id)
        .order_by(TransferWindow.number)
        .all()
    )
    if not windows:
        return

    team_ids = [
        row.id
        for row in db.query(FantasyTeam.id)
        .filter(
            FantasyTeam.league_id == league.id,
            FantasyTeam.status == FantasyTeamStatus.ACTIVE,
        )
        .all()
    ]
    if len(team_ids) < 2:
        return

    rounds = generate_round_robin_rounds(team_ids)
    if not rounds:
        return

    for i, window in enumerate(windows):
        pairs = rounds[i % len(rounds)]
        for home_id, away_id in pairs:
            if home_id is None:
                home_id, away_id = away_id, None
            db.add(
                LeagueMatchup(
                    league_id=league.id,
                    transfer_window_id=window.id,
                    home_team_id=home_id,
                    away_team_id=away_id,
                    result="bye" if away_id is None else None,
                )
            )


def resolve_matchups_for_window(
    db: Session, league_id: uuid.UUID, transfer_window_id: uuid.UUID
) -> None:
    """Fill in results for a window's matchups once that window's scoring
    has finalized (TeamWeeklyScore rows exist). No-op for matchups already
    resolved or for bye rows (already resolved at generation time)."""
    pending = (
        db.query(LeagueMatchup)
        .filter(
            LeagueMatchup.league_id == league_id,
            LeagueMatchup.transfer_window_id == transfer_window_id,
            LeagueMatchup.result.is_(None),
        )
        .all()
    )
    if not pending:
        return

    team_ids = {m.home_team_id for m in pending} | {
        m.away_team_id for m in pending if m.away_team_id is not None
    }
    scores = {
        row.fantasy_team_id: row.points
        for row in db.query(TeamWeeklyScore).filter(
            TeamWeeklyScore.fantasy_team_id.in_(team_ids),
            TeamWeeklyScore.transfer_window_id == transfer_window_id,
        )
    }

    for matchup in pending:
        home_points = scores.get(matchup.home_team_id)
        away_points = scores.get(matchup.away_team_id) if matchup.away_team_id else None
        if home_points is None or (matchup.away_team_id is not None and away_points is None):
            continue  # scoring for one side hasn't landed yet

        matchup.home_points = home_points
        matchup.away_points = away_points
        if home_points > away_points:
            matchup.result = "home_win"
        elif away_points > home_points:
            matchup.result = "away_win"
        else:
            matchup.result = "tie"


def get_h2h_standings(db: Session, league_id: uuid.UUID) -> list[dict]:
    """W-L-T standings, sorted by wins desc then points-for desc (the
    locked tiebreaker). Every active team appears, even at 0-0-0 before any
    window has scored."""
    teams = (
        db.query(FantasyTeam)
        .options(joinedload(FantasyTeam.user))
        .filter(FantasyTeam.league_id == league_id, FantasyTeam.status == FantasyTeamStatus.ACTIVE)
        .all()
    )
    resolved = (
        db.query(LeagueMatchup)
        .options(
            joinedload(LeagueMatchup.home_team).joinedload(FantasyTeam.user),
            joinedload(LeagueMatchup.away_team).joinedload(FantasyTeam.user),
        )
        .filter(
            LeagueMatchup.league_id == league_id,
            LeagueMatchup.result.in_(["home_win", "away_win", "tie"]),
        )
        .all()
    )

    records: dict[uuid.UUID, dict] = {
        team.id: {
            "fantasy_team_id": team.id,
            "team_name": team.name,
            "owner_username": team.user.username,
            "owner_avatar_url": team.user.avatar_url,
            "wins": 0,
            "losses": 0,
            "ties": 0,
            "points_for": Decimal("0"),
            "points_against": Decimal("0"),
        }
        for team in teams
    }

    def _row(team: FantasyTeam) -> dict:
        return records.setdefault(
            team.id,
            {
                "fantasy_team_id": team.id,
                "team_name": team.name,
                "owner_username": team.user.username,
                "owner_avatar_url": team.user.avatar_url,
                "wins": 0,
                "losses": 0,
                "ties": 0,
                "points_for": Decimal("0"),
                "points_against": Decimal("0"),
            },
        )

    for m in resolved:
        home = _row(m.home_team)
        away = _row(m.away_team)
        home["points_for"] += m.home_points
        home["points_against"] += m.away_points
        away["points_for"] += m.away_points
        away["points_against"] += m.home_points

        if m.result == "home_win":
            home["wins"] += 1
            away["losses"] += 1
        elif m.result == "away_win":
            away["wins"] += 1
            home["losses"] += 1
        else:
            home["ties"] += 1
            away["ties"] += 1

    return sorted(
        records.values(), key=lambda r: (-r["wins"], -r["points_for"])
    )


def _current_window_for_league(db: Session, league: League) -> TransferWindow | None:
    """The window whose [start_at, end_at] contains now, else the most
    recently started window (season not started yet / already ended)."""
    now = datetime.now(timezone.utc)
    current = (
        db.query(TransferWindow)
        .filter(
            TransferWindow.season_id == league.season_id,
            TransferWindow.start_at <= now,
            TransferWindow.end_at >= now,
        )
        .first()
    )
    if current:
        return current
    return (
        db.query(TransferWindow)
        .filter(TransferWindow.season_id == league.season_id, TransferWindow.start_at <= now)
        .order_by(TransferWindow.number.desc())
        .first()
    )


def get_matchups_for_window(
    db: Session,
    league_id: uuid.UUID,
    transfer_window_id: uuid.UUID | None,
    current_user: User,
    *,
    include_all: bool = False,
) -> list[LeagueMatchup]:
    """All matchups for a window (full scoreboard, not just the caller's).
    Defaults to the league's current window when transfer_window_id is
    omitted. include_all=True ignores window scoping entirely and returns
    the whole season's schedule, ordered by gameweek — for the Full
    Schedule view (the round-robin is generated upfront, so this is just a
    read, nothing to compute)."""
    league = _require_league(db, league_id)
    _require_membership(db, league_id, current_user.id)

    base_query = (
        db.query(LeagueMatchup)
        .join(TransferWindow, LeagueMatchup.transfer_window_id == TransferWindow.id)
        .options(
            joinedload(LeagueMatchup.transfer_window),
            joinedload(LeagueMatchup.home_team).joinedload(FantasyTeam.user),
            joinedload(LeagueMatchup.away_team).joinedload(FantasyTeam.user),
        )
        .filter(LeagueMatchup.league_id == league_id)
    )

    if include_all:
        return base_query.order_by(TransferWindow.number).all()

    window_id = transfer_window_id
    if window_id is None:
        window = _current_window_for_league(db, league)
        window_id = window.id if window else None
    if window_id is None:
        return []

    return base_query.filter(LeagueMatchup.transfer_window_id == window_id).all()


def get_standings(db: Session, league_id: uuid.UUID, current_user: User) -> list[dict]:
    _require_league(db, league_id)
    _require_membership(db, league_id, current_user.id)
    return get_h2h_standings(db, league_id)

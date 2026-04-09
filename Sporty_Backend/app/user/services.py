import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import case, func
from sqlalchemy.orm import Session, joinedload

from app.auth.models import User
from app.league.models import (
    FantasyTeam,
    LeagueMembership,
    TeamGameweekLineup,
    TeamWeeklyScore,
    Transfer,
    TransferWindow,
)
from app.user.schemas import UserUpdateRequest


def get_users(db: Session, page: int = 1, page_size: int = 20):
    query = db.query(User).filter(User.is_active.is_(True)).order_by(User.created_at.desc())
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return items, total


def get_user(db: Session, user_id: uuid.UUID) -> User:
    user = db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def _to_float(value: Decimal | float | int | None) -> float:
    if value is None:
        return 0.0
    return float(value)


def _league_payload(team: FantasyTeam) -> dict:
    sports = [ls.sport.display_name for ls in (team.league.sports or []) if getattr(ls, "sport", None)]
    return {
        "id": team.league.id,
        "name": team.league.name,
        "sports": sports,
    }


def get_user_activity(
    db: Session,
    user_id: uuid.UUID,
    league_id: uuid.UUID | None = None,
) -> list[dict]:
    """Return a mixed activity feed for a user profile.

    Activity sources:
    - Transfer events (actual transfer log entries)
    - Weekly points snapshots (TeamWeeklyScore)
    - Weekly rank snapshots (TeamWeeklyScore.rank_in_league)
    - Lineup submission snapshots (presence of lineup rows per transfer window)
    """
    get_user(db, user_id)
    now_utc = datetime.now(timezone.utc)
    week_cutoff = (now_utc - timedelta(days=6)).replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )

    activities: list[dict] = []

    transfer_query = (
        db.query(Transfer)
        .join(FantasyTeam, FantasyTeam.id == Transfer.fantasy_team_id)
        .filter(FantasyTeam.user_id == user_id, Transfer.created_at >= week_cutoff)
        .options(
            joinedload(Transfer.player_out),
            joinedload(Transfer.player_in),
            joinedload(Transfer.transfer_window),
            joinedload(Transfer.fantasy_team).joinedload(FantasyTeam.league),
        )
    )

    if league_id is not None:
        transfer_query = transfer_query.filter(FantasyTeam.league_id == league_id)

    transfers = transfer_query.order_by(Transfer.created_at.desc()).all()

    for transfer in transfers:
        team = transfer.fantasy_team
        if not team or not team.league:
            continue

        activities.append(
            {
                "id": f"transfer:{transfer.id}",
                "type": "transfer",
                "title": f"{transfer.player_in.name} in, {transfer.player_out.name} out",
                "description": f"Transfer completed in {team.league.name}",
                "timestamp": transfer.created_at,
                "league": _league_payload(team),
                "details": {
                    "player_in": transfer.player_in.name,
                    "player_out": transfer.player_out.name,
                    "position_in": transfer.player_in.position,
                    "position_out": transfer.player_out.position,
                    "cost": _to_float(transfer.cost_at_transfer),
                    "window_number": transfer.transfer_window.number if transfer.transfer_window else None,
                },
            }
        )

    weekly_scores_query = (
        db.query(TeamWeeklyScore)
        .join(FantasyTeam, FantasyTeam.id == TeamWeeklyScore.fantasy_team_id)
        .join(TransferWindow, TransferWindow.id == TeamWeeklyScore.transfer_window_id)
        .filter(
            FantasyTeam.user_id == user_id,
            TransferWindow.end_at >= week_cutoff,
        )
        .options(
            joinedload(TeamWeeklyScore.transfer_window),
            joinedload(TeamWeeklyScore.fantasy_team).joinedload(FantasyTeam.league),
        )
    )

    if league_id is not None:
        weekly_scores_query = weekly_scores_query.filter(FantasyTeam.league_id == league_id)

    weekly_scores = weekly_scores_query.order_by(TransferWindow.end_at.desc()).all()

    for score in weekly_scores:
        team = score.fantasy_team
        window = score.transfer_window
        if not team or not team.league or not window:
            continue

        timestamp = window.end_at
        points_value = _to_float(score.points)

        activities.append(
            {
                "id": f"points:{score.id}",
                "type": "points",
                "title": f"Scored {points_value:.1f} points",
                "description": f"Window {window.number} points for {team.name}",
                "timestamp": timestamp,
                "league": _league_payload(team),
                "details": {
                    "points": points_value,
                    "window_number": window.number,
                    "team_name": team.name,
                },
            }
        )

        if score.rank_in_league is not None:
            activities.append(
                {
                    "id": f"rank:{score.id}",
                    "type": "rank",
                    "title": f"Reached rank #{score.rank_in_league}",
                    "description": f"Window {window.number} standing in {team.league.name}",
                    "timestamp": timestamp,
                    "league": _league_payload(team),
                    "details": {
                        "rank": score.rank_in_league,
                        "window_number": window.number,
                        "team_name": team.name,
                    },
                }
            )

    lineup_windows_query = (
        db.query(
            TeamGameweekLineup.fantasy_team_id.label("team_id"),
            TeamGameweekLineup.transfer_window_id.label("window_id"),
            func.count(TeamGameweekLineup.id).label("lineup_size"),
            func.max(case((TeamGameweekLineup.is_captain.is_(True), 1), else_=0)).label("has_captain"),
            func.max(case((TeamGameweekLineup.is_vice_captain.is_(True), 1), else_=0)).label("has_vice"),
            func.max(TransferWindow.lineup_deadline_at).label("lineup_deadline_at"),
            func.max(TransferWindow.number).label("window_number"),
        )
        .join(FantasyTeam, FantasyTeam.id == TeamGameweekLineup.fantasy_team_id)
        .join(TransferWindow, TransferWindow.id == TeamGameweekLineup.transfer_window_id)
        .filter(
            FantasyTeam.user_id == user_id,
            TransferWindow.lineup_deadline_at >= week_cutoff,
        )
        .group_by(TeamGameweekLineup.fantasy_team_id, TeamGameweekLineup.transfer_window_id)
    )

    if league_id is not None:
        lineup_windows_query = lineup_windows_query.filter(FantasyTeam.league_id == league_id)

    lineup_windows = lineup_windows_query.order_by(func.max(TransferWindow.lineup_deadline_at).desc()).all()

    if lineup_windows:
        team_ids = [row.team_id for row in lineup_windows]
        teams = (
            db.query(FantasyTeam)
            .filter(FantasyTeam.id.in_(team_ids))
            .options(joinedload(FantasyTeam.league))
            .all()
        )
        team_map = {team.id: team for team in teams}

        for row in lineup_windows:
            team = team_map.get(row.team_id)
            if not team or not team.league:
                continue

            timestamp = row.lineup_deadline_at or now_utc
            captain_phrase = "captain + vice-captain set" if row.has_captain and row.has_vice else "lineup saved"
            activities.append(
                {
                    "id": f"lineup:{row.team_id}:{row.window_id}",
                    "type": "lineup",
                    "title": f"Submitted lineup for Window {int(row.window_number)}",
                    "description": f"{int(row.lineup_size)} starters set for {team.name} ({captain_phrase})",
                    "timestamp": timestamp,
                    "league": _league_payload(team),
                    "details": {
                        "window_number": int(row.window_number),
                        "lineup_size": int(row.lineup_size),
                        "captain_set": bool(row.has_captain),
                        "vice_captain_set": bool(row.has_vice),
                        "team_name": team.name,
                    },
                }
            )

    memberships_query = (
        db.query(LeagueMembership)
        .join(LeagueMembership.league)
        .filter(
            LeagueMembership.user_id == user_id,
            LeagueMembership.joined_at >= week_cutoff,
        )
        .options(joinedload(LeagueMembership.league))
    )

    if league_id is not None:
        memberships_query = memberships_query.filter(LeagueMembership.league_id == league_id)

    memberships = memberships_query.order_by(LeagueMembership.joined_at.desc()).all()

    for membership in memberships:
        league = membership.league
        if not league:
            continue

        is_creator = league.owner_id == user_id
        event_type = "league_created" if is_creator else "league_joined"
        title = "Created league" if is_creator else "Joined league"
        description = (
            f"You created {league.name}"
            if is_creator
            else f"You joined {league.name}"
        )

        activities.append(
            {
                "id": f"{event_type}:{membership.id}",
                "type": event_type,
                "title": title,
                "description": description,
                "timestamp": membership.joined_at,
                "league": {
                    "id": league.id,
                    "name": league.name,
                    "sports": [
                        row.sport.display_name
                        for row in (league.sports or [])
                        if getattr(row, "sport", None)
                    ],
                },
                "details": {
                    "membership_id": str(membership.id),
                },
            }
        )

    activities.sort(key=lambda item: item["timestamp"], reverse=True)
    return activities


def update_user(db: Session, target_user_id: uuid.UUID, acting_user_id: uuid.UUID, data: UserUpdateRequest) -> User:
    if target_user_id != acting_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Can only update your own profile")

    user = get_user(db, target_user_id)

    if data.username and data.username != user.username:
        username_taken = db.query(User).filter(User.username == data.username, User.id != user.id).first()
        if username_taken:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken")
        user.username = data.username

    if data.avatar_url is not None:
        user.avatar_url = data.avatar_url.strip() or None

    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, target_user_id: uuid.UUID, acting_user_id: uuid.UUID) -> None:
    if target_user_id != acting_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Can only delete your own account")

    user = get_user(db, target_user_id)
    user.is_active = False
    db.commit()

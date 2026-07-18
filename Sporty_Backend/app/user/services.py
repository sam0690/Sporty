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
    PointsPenalty,
    Sport,
    TeamGameweekLineup,
    TeamWeeklyScore,
    Transfer,
    TransferWindow,
)
from app.player.models import Player, RealTeam, UserFavouritePlayer, UserFavouriteTeam
from app.user.schemas import UserUpdateRequest


def get_users(db: Session, page: int = 1, page_size: int = 20):
    query = db.query(User).filter(User.is_active.is_(True)).order_by(User.created_at.desc())
    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return items, total


def get_user(db: Session, user_id: uuid.UUID) -> User:
    user = (
        db.query(User)
        .options(
            joinedload(User.favourite_teams).joinedload(UserFavouriteTeam.real_team).joinedload(RealTeam.sport),
            joinedload(User.favourite_players).joinedload(UserFavouritePlayer.player).joinedload(Player.sport),
        )
        .filter(User.id == user_id, User.is_active.is_(True))
        .first()
    )
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def _to_float(value: Decimal | float | int | None) -> float:
    if value is None:
        return 0.0
    return float(value)


def _league_payload(team: FantasyTeam) -> dict:
    sports = []
    if team.league and team.league.sports:
        for ls in team.league.sports:
            sport = getattr(ls, "sport", None)
            if sport and sport.display_name:
                sports.append(sport.display_name)
    return {
        "id": team.league.id if team.league else None,
        "name": team.league.name if team.league else "Unknown League",
        "sports": sports,
    }


def get_user_public_stats(db: Session, user_id: uuid.UUID) -> dict:
    """Public profile stats for ANY user: their leagues with per-league points
    and best rank, plus aggregate totals. Unlike the dashboard, this is keyed by
    the target user (not the viewer), so other users' profiles are accurate."""
    user = get_user(db, user_id)  # 404 if missing/inactive

    teams = (
        db.query(FantasyTeam)
        .options(joinedload(FantasyTeam.league))
        .filter(FantasyTeam.user_id == user_id)
        .all()
    )

    # One grouped pass for per-team total points + best (min) rank.
    aggregates: dict[uuid.UUID, tuple[float, int | None]] = {}
    if teams:
        rows = (
            db.query(
                TeamWeeklyScore.fantasy_team_id,
                func.coalesce(func.sum(TeamWeeklyScore.points), 0),
                func.min(TeamWeeklyScore.rank_in_league),
            )
            .filter(TeamWeeklyScore.fantasy_team_id.in_([t.id for t in teams]))
            .group_by(TeamWeeklyScore.fantasy_team_id)
            .all()
        )
        aggregates = {fid: (_to_float(pts), rank) for fid, pts, rank in rows}

        # Budget-overage points penalties, netted out same as get_dashboard_stats —
        # TeamWeeklyScore.points stays untouched at write time, so raw sums here
        # were showing pre-penalty totals, inconsistent with the dashboard.
        penalty_rows = (
            db.query(
                PointsPenalty.fantasy_team_id,
                func.coalesce(func.sum(PointsPenalty.points_charged), 0),
            )
            .filter(PointsPenalty.fantasy_team_id.in_([t.id for t in teams]))
            .group_by(PointsPenalty.fantasy_team_id)
            .all()
        )
        penalty_by_team = {fid: _to_float(charged) for fid, charged in penalty_rows}
        aggregates = {
            fid: (pts - penalty_by_team.get(fid, 0.0), rank)
            for fid, (pts, rank) in aggregates.items()
        }

    leagues: list[dict] = []
    total_points = 0.0
    best_rank: int | None = None
    for team in teams:
        points, rank = aggregates.get(team.id, (0.0, None))
        sport_name = "football"
        if team.league and team.league.sports:
            first = getattr(team.league.sports[0], "sport", None)
            if first and first.name:
                sport_name = first.name
        leagues.append(
            {
                "league_id": team.league.id if team.league else None,
                "name": team.league.name if team.league else "Unknown League",
                "sport": sport_name,
                "rank": rank,
                "points": points,
            }
        )
        total_points += points
        if rank is not None:
            best_rank = rank if best_rank is None else min(best_rank, rank)

    return {
        "user_id": user.id,
        "username": user.username,
        "avatar_url": user.avatar_url,
        "created_at": user.created_at,
        "total_points": total_points,
        "total_leagues": len(teams),
        "best_rank": best_rank,
        "leagues": leagues,
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
        if not transfer.player_in or not transfer.player_out:
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

    if data.email_notifications_enabled is not None:
        user.email_notifications_enabled = data.email_notifications_enabled

    db.commit()
    db.refresh(user)
    return user


def _resolve_sport(db: Session, sport_name: str) -> Sport:
    sport = db.query(Sport).filter(Sport.name == sport_name.strip().lower()).first()
    if not sport:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sport not found")
    return sport


def set_favourite_team(
    db: Session,
    target_user_id: uuid.UUID,
    acting_user_id: uuid.UUID,
    sport_name: str,
    team_id: uuid.UUID,
) -> User:
    """Set (or replace) the user's favourite team for a sport. One row per
    (user, sport) — UNIQUE(user_id, sport_id) backs this as an upsert."""
    if target_user_id != acting_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Can only update your own profile")

    sport = _resolve_sport(db, sport_name)
    team = db.query(RealTeam).filter(RealTeam.id == team_id, RealTeam.sport_id == sport.id).first()
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found for this sport")

    existing = (
        db.query(UserFavouriteTeam)
        .filter(UserFavouriteTeam.user_id == target_user_id, UserFavouriteTeam.sport_id == sport.id)
        .first()
    )
    if existing:
        existing.real_team_id = team.id
    else:
        db.add(UserFavouriteTeam(user_id=target_user_id, sport_id=sport.id, real_team_id=team.id))

    db.commit()
    return get_user(db, target_user_id)


def remove_favourite_team(
    db: Session, target_user_id: uuid.UUID, acting_user_id: uuid.UUID, sport_name: str
) -> User:
    if target_user_id != acting_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Can only update your own profile")

    sport = _resolve_sport(db, sport_name)
    db.query(UserFavouriteTeam).filter(
        UserFavouriteTeam.user_id == target_user_id, UserFavouriteTeam.sport_id == sport.id
    ).delete()
    db.commit()
    return get_user(db, target_user_id)


def set_favourite_player(
    db: Session,
    target_user_id: uuid.UUID,
    acting_user_id: uuid.UUID,
    sport_name: str,
    player_id: uuid.UUID,
) -> User:
    """Set (or replace) the user's favourite player for a sport. One row per
    (user, sport) — UNIQUE(user_id, sport_id) backs this as an upsert."""
    if target_user_id != acting_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Can only update your own profile")

    sport = _resolve_sport(db, sport_name)
    player = db.query(Player).filter(Player.id == player_id, Player.sport_id == sport.id).first()
    if not player:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Player not found for this sport")

    existing = (
        db.query(UserFavouritePlayer)
        .filter(UserFavouritePlayer.user_id == target_user_id, UserFavouritePlayer.sport_id == sport.id)
        .first()
    )
    if existing:
        existing.player_id = player.id
    else:
        db.add(UserFavouritePlayer(user_id=target_user_id, sport_id=sport.id, player_id=player.id))

    db.commit()
    return get_user(db, target_user_id)


def remove_favourite_player(
    db: Session, target_user_id: uuid.UUID, acting_user_id: uuid.UUID, sport_name: str
) -> User:
    if target_user_id != acting_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Can only update your own profile")

    sport = _resolve_sport(db, sport_name)
    db.query(UserFavouritePlayer).filter(
        UserFavouritePlayer.user_id == target_user_id, UserFavouritePlayer.sport_id == sport.id
    ).delete()
    db.commit()
    return get_user(db, target_user_id)


def delete_user(
    db: Session,
    target_user_id: uuid.UUID,
    acting_user_id: uuid.UUID,
    *,
    admin_override: bool = False,
) -> None:
    if not admin_override and target_user_id != acting_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Can only delete your own account")

    user = get_user(db, target_user_id)
    user.is_active = False
    db.commit()

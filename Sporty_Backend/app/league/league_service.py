"""League core — CRUD, membership lifecycle, seasons/renewal (dynasty), sports, settings, transfer windows, dashboard.

Split from the former 3,972-line app/league/services.py; that module is now a
facade re-exporting every name, so external imports keep working unchanged.
"""

import json
import logging
import random
import secrets
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session, aliased, joinedload, selectinload, with_loader_criteria
from app.auth.models import User
from app.league.models import (
    BudgetTransaction,
    DraftPick,
    FantasyTeam,
    FantasyTeamStatus,
    PointsPenalty,
    RosterMove,
    TeamGameweekLineup,
    TransferWindow,
    League,
    LeagueMembership,
    LeagueMembershipStatus,
    LeagueStatus,
    LeagueSport,
    LineupSlot,
    Season,
    Sport,
    TeamPlayer,
    Transfer,
    TeamWeeklyScore,
)
from app.league.schemas import LeagueCreate, LineupSlotCreate
from app.league.sportConfigs import derive_sport_type, get_squad_size
from app.player.models import Player, PlayerGameweekStat
from app.core.redis import get_redis
from app.services.budget_utils import calculate_refund
from app.services.scoring.window_locator import find_equivalent_season_for_sport
from app.core.config import settings
from app.squad.services import (
    check_full_squad_constraints,
    check_squad_constraints,
    validate_lineup_for_league_type,
    validate_position_slots,
    validate_squad_size,
)
from app.league.service_helpers import SUPPORTED_LEAGUE_SPORTS, VALID_TRANSITIONS, _LEAGUE_OPTIONS, _MEMBERSHIP_OPTIONS, _current_transfer_window, _editable_transfer_window, _generate_invite_code, _league_window_competition, _league_window_total, _require_fantasy_team, _require_league, _require_membership, _serialize_window, _window_competition_clause

logger = logging.getLogger(__name__)




# ═══════════════════════════════════════════════════════════════════════════════
# Section 1 — League lifecycle
# ═══════════════════════════════════════════════════════════════════════════════


def create_league(
    db: Session,
    data: LeagueCreate,
    owner: User,
) -> League:
    """Create a new league and auto-enrol the owner as the first member.

    Why auto-enrol?
    ────────────────
    The owner must be a member to participate (set lineup, make picks).
    Making the caller do a separate join_league() after create is error-
    prone: if the second call fails, the owner is locked out of their
    own league. Doing both in one transaction avoids that half-state.

    Does NOT commit — caller owns the transaction.
    """
    # Check for duplicate name in same season
    existing = db.query(League).filter(
        League.season_id == data.season_id,
        League.name == data.name
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A league with the name '{data.name}' already exists for this season",
        )

    invite_code = _generate_invite_code(db)

    season = db.query(Season).filter(Season.id == data.season_id).first()
    if not season:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Season not found",
        )

    # A UNIFIED multisport season has no owning sport (sport_id IS NULL) — every
    # sport it plays resolves its own current season via the LeagueSport loop
    # below, so the single-season-sport validation here is skipped for it. See
    # docs/UNIFIED_MULTISPORT_SCHEDULE_PLAN.md §2.
    is_unified = season.sport_id is None
    season_sport = None
    if not is_unified:
        season_sport = db.query(Sport).filter(Sport.id == season.sport_id).first()
        if not season_sport:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Season sport not found",
            )

        if season_sport.name not in SUPPORTED_LEAGUE_SPORTS:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Sport '{season_sport.name}' is not supported",
            )

    league_start: date = data.start_date or season.start_date
    league_end: date = data.end_date or season.end_date
    if league_end < league_start:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_date must be on or after start_date",
        )

    if data.is_head_to_head and data.allow_midseason_join:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Head-to-head leagues can't allow mid-season joining — the "
                "matchup schedule is locked once the season starts."
            ),
        )

    new_id = uuid.uuid4()
    league = League(
        id=new_id,
        owner_id=owner.id,
        season_id=data.season_id,
        name=data.name,
        invite_code=invite_code,
        status=LeagueStatus.SETUP,
        is_public=data.is_public,
        max_teams=data.max_teams,
        squad_size=data.squad_size,
        budget_per_team=data.budget_per_team,
        draft_mode=data.draft_mode,
        draft_pick_seconds=data.draft_pick_seconds,
        is_head_to_head=data.is_head_to_head,
        allow_midseason_join=data.allow_midseason_join,
        transfers_per_window=data.transfers_per_window,
        # transfer_day intentionally not threaded through: windows are
        # season-scoped now (Season.transfer_day, admin-generated) — this
        # column is dead, left at its default. See app/league/models.py.
        start_date=league_start,
        end_date=league_end,
        # A freshly created league is the head of its own season lineage —
        # see renew_league() for how later seasons attach to this group.
        season_group_id=new_id,
        season_number=1,
    )
    db.add(league)

    # 2. Attach sports from payload
    # (Bug fix: removed default sport fallback and added strict validation)
    requested_sports = getattr(data, "sports", [])
    if not requested_sports:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one sport must be specified in the creation payload",
        )

    # The season's own sport must be one of the league's requested sports —
    # otherwise every lineup/transfer this league ever saves gets keyed to
    # the wrong sport's transfer windows (season_id drives "current window"
    # resolution), while the sport-aware scorer never touches those windows
    # for this league. A multisport league's season is deliberately only one
    # of its N sports (see find_equivalent_window_for_sport), so this only
    # rejects a season whose sport isn't in the list at all.
    if not is_unified and season_sport.name not in requested_sports:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"The selected season is for {season_sport.name}, but this "
                f"league is for {', '.join(requested_sports)}. Choose a "
                "season that matches one of the league's sports."
            ),
        )

    # A unified season is a multisport schedule — it makes no sense for a
    # single-sport league. Soft validation otherwise (chosen): any all-current
    # sport combo may use it; the per-sport current-season hard-block in the
    # LeagueSport loop below is the real validator. See PLAN §2.
    if is_unified and len(requested_sports) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A unified multisport season requires a league with at least two sports.",
        )

    # Multisport leagues are only creatable while every sport involved has a
    # season live right now. _current_season_for_sport below already enforces
    # this for the secondary sports; requiring the PRIMARY season to also be
    # current closes the only gap — without it, every sport independently
    # covering "today" is what guarantees they all overlap each other (two
    # ranges containing the same point necessarily overlap), so this one
    # check is what makes that guarantee airtight rather than a separate
    # date-range overlap computation being needed.
    if len(requested_sports) > 1 and not (season.start_date <= date.today() <= season.end_date):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Cannot create a multisport league: the selected season isn't in "
                "progress right now — every sport in a multisport league must "
                "have a season live at the same time."
            ),
        )

    # Derive squad size from sport type
    sport_type = derive_sport_type(requested_sports)
    squad_size = get_squad_size(sport_type)
    league.squad_size = squad_size

    # Resolve sport names to IDs
    sport_records = db.query(Sport).filter(Sport.name.in_(requested_sports)).all()
    found_names = {s.name for s in sport_records}
    for sport_name in requested_sports:
        if sport_name not in found_names:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Sport '{sport_name}' not found",
            )
    
    for s in sport_records:
        if s.id == season.sport_id:
            # The season the creator explicitly picked — no lookup needed,
            # no ambiguity. (Never taken for a unified season: season.sport_id
            # is None, so every sport falls to the self-resolving else branch.)
            mapped_season_id = season.id
        else:
            # A secondary sport: resolve its own current season. Hard-block
            # rather than create a dangling LeagueSport.season_id=None — see
            # _current_season_for_sport's docstring.
            mapped_season = _current_season_for_sport(db, s.id)
            if mapped_season is None:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Cannot create this league: '{s.name}' has no current season yet",
                )
            mapped_season_id = mapped_season.id
        comp_filter = getattr(data, "competition_filters", {}).get(s.name.strip().lower())
        league.sports.append(
            LeagueSport(sport_id=s.id, season_id=mapped_season_id, competition_filter=comp_filter)
        )

    # 3. Auto-enrol owner
    membership = LeagueMembership(
        user_id=owner.id,
    )
    league.memberships.append(membership)

    db.flush()

    # Re-load with eager options so the caller can serialise to LeagueResponse
    return _require_league(db, league.id, eager=True)



def _attach_dynasty_history_info(db: Session, league: League) -> None:
    """Set the transient `was_dynasty` attribute: was this league itself
    created via a dynasty rollover? Derived from the audit trail
    (`_carry_over_dynasty_rosters` logs a RosterMove(move_type=
    'dynasty_carryover') per carried player) rather than a stored column —
    one indexed lookup, no schema change for a single-league read."""
    league.was_dynasty = (
        db.query(RosterMove)
        .filter(
            RosterMove.league_id == league.id,
            RosterMove.move_type == "dynasty_carryover",
        )
        .first()
        is not None
    )



def get_league(db: Session, league_id: uuid.UUID) -> League:
    """Fetch a single league or raise 404."""
    league = _require_league(db, league_id, eager=True)
    _attach_midseason_join_info(db, league)
    _attach_dynasty_history_info(db, league)
    return league



def get_leagues_for_user(db: Session, user_id: uuid.UUID) -> list[League]:
    """Return all leagues a user is a member of.

    Why query through LeagueMembership instead of League.owner_id?
    ──────────────────────────────────────────────────────────────
    A user can PARTICIPATE in leagues they don't OWN. owner_id only
    gives you leagues the user created. LeagueMembership gives you
    every league the user joined (including ones they own, since the
    owner is auto-enrolled in create_league).
    """
    leagues = (
        db.query(League)
        .join(LeagueMembership)
        .filter(LeagueMembership.user_id == user_id)
        .filter(LeagueMembership.status == LeagueMembershipStatus.ACTIVE)
        .options(*_LEAGUE_OPTIONS)
        .order_by(League.created_at.desc())
        .all()
    )
    _attach_my_team_summaries(db, leagues, user_id)
    return leagues



def _attach_my_team_summaries(
    db: Session,
    leagues: list[League],
    user_id: uuid.UUID,
) -> None:
    """Populate each league's transient `my_team` attribute for the request user.

    Sets the user's team id + name, their TOTAL season points, and their season
    rank (position when every team in that league is ordered by total points,
    highest first). Ranking needs every team's total, so all teams across these
    leagues are aggregated in ONE grouped query instead of N per-league
    round-trips. Leagues where the user has no active team keep `my_team = None`.
    Rank stays None until scoring has begun (no team has points yet).

    `my_team` is a plain (non-mapped) instance attribute — LeagueResponse reads
    it via `from_attributes`. This is a read helper; it does not mutate the DB.
    """
    for league in leagues:
        league.my_team = None

    if not leagues:
        return

    league_ids = [league.id for league in leagues]

    # The requesting user's active team in each of these leagues (id + name).
    my_team_by_league = {
        team.league_id: team
        for team in (
            db.query(FantasyTeam)
            .filter(
                FantasyTeam.league_id.in_(league_ids),
                FantasyTeam.user_id == user_id,
                FantasyTeam.status == FantasyTeamStatus.ACTIVE,
            )
            .all()
        )
    }
    if not my_team_by_league:
        return

    # Total season points for every active team in these leagues, so we can
    # rank. outerjoin keeps teams with no scored weeks yet (total = 0).
    totals_by_league: dict[uuid.UUID, list] = {}
    total_rows = (
        db.query(
            FantasyTeam.league_id.label("league_id"),
            FantasyTeam.id.label("team_id"),
            func.coalesce(func.sum(TeamWeeklyScore.points), 0).label("total"),
        )
        .outerjoin(
            TeamWeeklyScore,
            TeamWeeklyScore.fantasy_team_id == FantasyTeam.id,
        )
        .filter(
            FantasyTeam.league_id.in_(league_ids),
            FantasyTeam.status == FantasyTeamStatus.ACTIVE,
        )
        .group_by(FantasyTeam.league_id, FantasyTeam.id)
        .all()
    )
    for row in total_rows:
        totals_by_league.setdefault(row.league_id, []).append(row)

    # Budget-overage points penalties, netted out at read time — same
    # approach as standings_service.py and get_dashboard_stats.
    team_ids = [row.team_id for rows in totals_by_league.values() for row in rows]
    penalty_by_team: dict[uuid.UUID, Decimal] = {}
    if team_ids:
        for row in (
            db.query(
                PointsPenalty.fantasy_team_id.label("team_id"),
                func.sum(PointsPenalty.points_charged).label("charged"),
            )
            .filter(PointsPenalty.fantasy_team_id.in_(team_ids))
            .group_by(PointsPenalty.fantasy_team_id)
            .all()
        ):
            penalty_by_team[row.team_id] = row.charged

    # ── Attention/triage fields (batched over every league's season) ────────
    # editable window = soonest window whose lineup deadline is still in the
    # future (mirrors _find_editable_transfer_window); live = a window is in
    # progress and locked (a gameweek is playing).
    now = datetime.now(timezone.utc)
    season_ids = {lg.season_id for lg in leagues if lg.season_id}
    editable_by_season: dict[uuid.UUID, TransferWindow] = {}
    live_by_season: dict[uuid.UUID, bool] = {}
    if season_ids:
        for w in (
            db.query(TransferWindow)
            .filter(TransferWindow.season_id.in_(season_ids))
            .order_by(TransferWindow.start_at.asc())
            .all()
        ):
            if w.lineup_deadline_at > now and w.season_id not in editable_by_season:
                editable_by_season[w.season_id] = w
            if w.start_at <= now <= w.end_at and w.lineup_locked:
                live_by_season[w.season_id] = True

    # Which teams already have a starting XI saved for their editable window.
    lineup_set: set[tuple[uuid.UUID, uuid.UUID]] = set()
    editable_pairs = [
        (team.id, editable_by_season[lg.season_id].id)
        for lg in leagues
        if (team := my_team_by_league.get(lg.id)) is not None
        and lg.season_id in editable_by_season
    ]
    if editable_pairs:
        for row in (
            db.query(
                TeamGameweekLineup.fantasy_team_id,
                TeamGameweekLineup.transfer_window_id,
            )
            .filter(
                TeamGameweekLineup.fantasy_team_id.in_({p[0] for p in editable_pairs}),
                TeamGameweekLineup.transfer_window_id.in_({p[1] for p in editable_pairs}),
                TeamGameweekLineup.is_starter.is_(True),
            )
            .distinct()
            .all()
        ):
            lineup_set.add((row.fantasy_team_id, row.transfer_window_id))

    for league in leagues:
        team = my_team_by_league.get(league.id)
        if team is None:
            continue

        rows = totals_by_league.get(league.id, [])
        net_by_team = {
            r.team_id: Decimal(r.total) - penalty_by_team.get(r.team_id, Decimal("0"))
            for r in rows
        }
        ranked = sorted(net_by_team.items(), key=lambda item: item[1], reverse=True)
        my_total = net_by_team.get(team.id, Decimal("0"))
        my_deducted = penalty_by_team.get(team.id, Decimal("0"))
        # Only rank once scoring has started; before that every team ties at 0
        # and a position number would be meaningless. `!= 0`, not `> 0`, so this
        # agrees with get_league_leaderboard: one negative total is still a
        # scored board, and that team ranks below the teams on zero.
        scoring_started = any(total != 0 for _, total in ranked)
        rank = (
            next((i + 1 for i, (tid, _) in enumerate(ranked) if tid == team.id), None)
            if scoring_started
            else None
        )

        editable = editable_by_season.get(league.season_id)
        league.my_team = {
            "id": team.id,
            "name": team.name,
            "rank": rank,
            "points": my_total,
            "points_deducted": my_deducted,
            "lineup_deadline_at": editable.lineup_deadline_at if editable else None,
            "has_lineup": bool(editable and (team.id, editable.id) in lineup_set),
            "live": live_by_season.get(league.season_id, False),
        }



def update_league_status(
    db: Session,
    league_id: uuid.UUID,
    new_status: LeagueStatus,
    current_user: User,
    *,
    admin_override: bool = False,
) -> League:
    """Transition a league to a new lifecycle state.

    Valid transitions (enforced here, not at the DB level):
        SETUP     → DRAFTING | ACTIVE
        DRAFTING  → ACTIVE
        ACTIVE    → COMPLETED
        (no backward transitions — a completed league can't revert)

    Why enforce at the service layer, not DB?
    ──────────────────────────────────────────
    A CHECK constraint can't express "old value must be X to set Y"
    because CHECK only sees the NEW row, not the old one. A trigger
    could do it, but trigger-based state machines are hard to debug
    and test. Service-layer enforcement is explicit and testable.

    Only the league OWNER can change status (admin_override=True bypasses
    this for platform-admin use — see app/admin/services.py).
    Does NOT commit — caller owns the transaction.
    """
    league = _require_league(db, league_id)

    if not admin_override and league.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the league owner can change the status",
        )

    # Mode-aware lifecycle restrictions:
    # - Budget leagues do not have a drafting phase.
    # - Draft leagues should not skip directly from setup to active.
    if not league.draft_mode and new_status == LeagueStatus.DRAFTING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Budget leagues cannot transition to drafting",
        )
    if (
        league.draft_mode
        and league.status == LeagueStatus.SETUP
        and new_status == LeagueStatus.ACTIVE
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Draft leagues must enter drafting before becoming active",
        )

    if (
        not league.draft_mode
        and league.status == LeagueStatus.SETUP
        and new_status == LeagueStatus.ACTIVE
    ):
        member_count = (
            db.query(func.count(LeagueMembership.id))
            .filter(LeagueMembership.league_id == league.id)
            .filter(LeagueMembership.status == LeagueMembershipStatus.ACTIVE)
            .scalar()
        )
        if member_count < settings.LEAGUE_MIN_MEMBERS_TO_ACTIVATE:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "At least "
                    f"{settings.LEAGUE_MIN_MEMBERS_TO_ACTIVATE} members are required "
                    "before activating this league"
                ),
            )

        has_windows = db.query(
            db.query(TransferWindow)
            .filter(
                TransferWindow.season_id == league.season_id,
                _window_competition_clause(_league_window_competition(db, league)),
            )
            .exists()
        ).scalar()
        if not has_windows:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Transfer windows haven't been generated for this season yet",
            )

    allowed_next = VALID_TRANSITIONS.get(league.status.value, [])
    if new_status.value not in allowed_next:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Cannot transition from '{league.status.value}' "
                f"to '{new_status.value}'"
            ),
        )

    league.status = new_status
    db.flush()

    if new_status == LeagueStatus.ACTIVE and league.is_head_to_head:
        # Commissioner manually activated (bypassing the automatic daily
        # sweep / draft-completion transition, which already do this) —
        # the H2H schedule still needs generating exactly once here too.
        from app.services.matchup_service import generate_matchups_for_league

        generate_matchups_for_league(db, league)

    # Re-load with eager options so the caller can serialise to LeagueResponse
    return _require_league(db, league_id, eager=True)



def get_season_history(db: Session, league_id: uuid.UUID) -> list[League]:
    """Return every league in the same season lineage as league_id, oldest first.

    A league's own lineage always includes itself (season_group_id defaults
    to its own id when it has never been renewed — see create_league).
    """
    league = _require_league(db, league_id)
    return (
        db.query(League)
        .filter(League.season_group_id == league.season_group_id)
        .order_by(League.season_number.asc())
        .all()
    )



def _next_available_season(db: Session, source: League) -> Season:
    """Pick the season to renew `source` into when the caller didn't specify one.

    Earliest active Season, for the source league's first sport, starting
    after the source league's end_date. Raises 409 if none exists yet —
    the commissioner has to wait for an admin to create next year's Season
    (see app/admin/services.py:create_season_admin).
    """
    first_sport_id = (
        db.query(LeagueSport.sport_id)
        .filter(LeagueSport.league_id == source.id)
        .order_by(LeagueSport.created_at.asc())
        .limit(1)
        .scalar()
    )
    query = db.query(Season).filter(Season.is_active.is_(True))
    if first_sport_id:
        query = query.filter(Season.sport_id == first_sport_id)
    if source.end_date:
        query = query.filter(Season.start_date > source.end_date)
    season = query.order_by(Season.start_date.asc()).first()
    if not season:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Next season isn't available yet — ask an admin to create it",
        )
    return season



def renew_league(
    db: Session,
    source_league_id: uuid.UUID,
    target_season_id: uuid.UUID | None,
    current_user: User,
    *,
    admin_override: bool = False,
    dynasty: bool = False,
) -> League:
    from app.league.draft_service import start_draft  # lazy: breaks league<->draft import cycle
    """Start the next season of a completed league: a new League row, same
    lineage (season_group_id, season_number + 1), same settings/sports/slots,
    members auto carried over.

    dynasty=False (default): squads are NOT copied — team creation is a
    separate step (start_draft / build_initial_team), so the new league
    starts with zero FantasyTeam rows, same as before.

    dynasty=True: every active member's active roster is copied wholesale
    into a brand-new FantasyTeam in the new league (both draft- and
    budget-mode leagues), no re-draft. See _carry_over_dynasty_rosters().
    The new league skips DRAFTING and goes straight to ACTIVE, since squads
    already exist — there's nothing left to draft or build.

    Only the league OWNER can renew (admin_override=True bypasses this for
    platform-admin use). Does NOT commit — caller owns the transaction.
    """
    source = _require_league(db, source_league_id, eager=True)

    if not admin_override and source.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the league owner can start the next season",
        )

    if source.status != LeagueStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only completed leagues can start a new season",
        )

    already_renewed = (
        db.query(League)
        .filter(
            League.season_group_id == source.season_group_id,
            League.season_number == source.season_number + 1,
        )
        .first()
    )
    if already_renewed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This league has already started its next season",
        )

    if target_season_id is not None:
        target_season = db.query(Season).filter(Season.id == target_season_id).first()
        if not target_season:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Season not found")
        if source.end_date and target_season.start_date <= source.end_date:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Target season must start after the current season ends",
            )
    else:
        target_season = _next_available_season(db, source)

    new_id = uuid.uuid4()
    new_league = League(
        id=new_id,
        owner_id=source.owner_id,
        season_id=target_season.id,
        name=source.name,
        invite_code=_generate_invite_code(db),
        status=LeagueStatus.SETUP,
        is_public=source.is_public,
        max_teams=source.max_teams,
        squad_size=source.squad_size,
        budget_per_team=source.budget_per_team,
        draft_mode=source.draft_mode,
        allow_midseason_join=source.allow_midseason_join,
        transfers_per_window=source.transfers_per_window,
        # transfer_day intentionally not threaded through — see create_league.
        start_date=target_season.start_date,
        end_date=target_season.end_date,
        season_group_id=source.season_group_id,
        season_number=source.season_number + 1,
    )
    db.add(new_league)

    for league_sport in source.sports:
        new_league.sports.append(
            LeagueSport(
                sport_id=league_sport.sport_id,
                competition_filter=league_sport.competition_filter,
            )
        )

    source_slots = db.query(LineupSlot).filter(LineupSlot.league_id == source.id).all()
    for slot in source_slots:
        db.add(LineupSlot(
            league_id=new_id,
            sport_id=slot.sport_id,
            position=slot.position,
            min_count=slot.min_count,
            max_count=slot.max_count,
        ))

    active_members = (
        db.query(LeagueMembership)
        .filter(
            LeagueMembership.league_id == source.id,
            LeagueMembership.status == LeagueMembershipStatus.ACTIVE,
        )
        .all()
    )
    for member in active_members:
        new_league.memberships.append(LeagueMembership(user_id=member.user_id))

    db.flush()

    if dynasty:
        _carry_over_dynasty_rosters(db, source, new_league, target_season, active_members)

    return _require_league(db, new_id, eager=True)



def _carry_over_dynasty_rosters(
    db: Session,
    source: League,
    new_league: League,
    target_season: Season,
    active_members: list[LeagueMembership],
) -> None:
    """Copy every remaining member's active roster from `source` into a new
    FantasyTeam in `new_league`, flat (no keeper cost), then activate the
    league and seed its waiver order. Called only from renew_league(dynasty=True).

    Budget-mode teams: current_budget is recomputed against the new season's
    budget_per_team using each carried player's source cost_at_acquisition —
    this can legitimately go negative if prices drifted since last season.
    Acquisition paths already freeze a negative-budget team out of new
    purchases until it drops back to >= 0 (see FantasyTeam.current_budget).

    Draft-mode teams: league-wide active-player-ownership stays exclusive
    automatically — it's a partial unique index scoped to (league_id,
    player_id), and copying every source team's mutually-exclusive roster
    into the same new league_id can't collide with itself.

    Players/slots that no longer fit the new season (retired player, changed
    LineupSlot config) are intentionally NOT blocked here — squad legality is
    re-checked per team and any violation is logged for the owner to fix via
    the normal transfer/waiver flow rather than blocking the whole renewal.
    """
    first_window = (
        db.query(TransferWindow)
        .filter(TransferWindow.season_id == target_season.id)
        .order_by(TransferWindow.number)
        .first()
    )
    if not first_window:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No transfer windows exist for the target season yet — "
            "ask an admin to create them before starting a dynasty season",
        )

    active_user_ids = {m.user_id for m in active_members}
    source_teams = (
        db.query(FantasyTeam)
        .filter(
            FantasyTeam.league_id == source.id,
            FantasyTeam.user_id.in_(active_user_ids),
            FantasyTeam.status == FantasyTeamStatus.ACTIVE,
        )
        .all()
    )

    lineup_slots = db.query(LineupSlot).filter(LineupSlot.league_id == new_league.id).all()

    for source_team in source_teams:
        source_active_players = (
            db.query(TeamPlayer)
            .filter(
                TeamPlayer.fantasy_team_id == source_team.id,
                TeamPlayer.released_window_id.is_(None),
            )
            .all()
        )
        total_cost = sum((tp.cost_at_acquisition for tp in source_active_players), Decimal("0"))

        new_team = FantasyTeam(
            league_id=new_league.id,
            user_id=source_team.user_id,
            name=source_team.name,
            current_budget=new_league.budget_per_team - total_cost,
            starting_budget=new_league.budget_per_team,
            starting_squad_size=new_league.squad_size,
            status=FantasyTeamStatus.ACTIVE,
        )
        db.add(new_team)
        db.flush()

        new_team_players = []
        for tp in source_active_players:
            new_tp = TeamPlayer(
                fantasy_team_id=new_team.id,
                league_id=new_league.id,
                is_draft=new_league.draft_mode,
                player_id=tp.player_id,
                sport_type=tp.sport_type,
                acquired_window_id=first_window.id,
                cost_at_acquisition=tp.cost_at_acquisition,
            )
            db.add(new_tp)
            new_team_players.append(new_tp)
            db.add(RosterMove(
                league_id=new_league.id,
                fantasy_team_id=new_team.id,
                move_type="dynasty_carryover",
                add_player_id=tp.player_id,
                window_id=first_window.id,
            ))
        db.flush()

        try:
            validate_squad_size(new_team_players, new_league, sports=new_league.sports)
            validate_position_slots(new_team_players, lineup_slots)
        except ValueError as exc:
            logger.warning(
                "Dynasty carryover: team=%s in league=%s failed post-copy squad "
                "validation (owner must fix via transfer/waiver): %s",
                new_team.id, new_league.id, exc,
            )

    # Squads already exist — nothing left to draft or build. Skip DRAFTING.
    new_league.status = LeagueStatus.ACTIVE
    db.flush()

    from app.services import waiver_service

    waiver_service.init_waiver_order_from_standings(db, new_league, source.id)
    db.flush()



# ═══════════════════════════════════════════════════════════════════════════════
# Section 2 — Membership
# ═══════════════════════════════════════════════════════════════════════════════


def join_league(
    db: Session,
    invite_code: str,
    user: User,
) -> LeagueMembership:
    """Join a league using its invite code.

    Guards:
      1. Invite code must match an existing league.
      2. League must be in SETUP status (no joining mid-draft or mid-season).
      3. User must not already be a member (idempotency via 409, not silent
         duplicate).
      4. League must not be full (member count < max_teams).

    Why check member count with .count() instead of len(league.memberships)?
    ────────────────────────────────────────────────────────────────────────
    len(league.memberships) would load ALL membership objects into memory
    just to count them. A COUNT(*) query is cheaper — the DB counts rows
    without materialising them.

    Does NOT commit — caller owns the transaction.
    """
    normalized_code = invite_code.strip()

    # Prefer exact match first (fast path), then fallback to case-insensitive
    # lookup so users can join even if they typed different letter casing.
    league = (
        db.query(League)
        .filter(League.invite_code == normalized_code)
        .first()
    )
    if not league:
        case_insensitive_matches = (
            db.query(League)
            .filter(func.lower(League.invite_code) == normalized_code.lower())
            .all()
        )
        if len(case_insensitive_matches) == 1:
            league = case_insensitive_matches[0]
        elif len(case_insensitive_matches) > 1:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Invite code is ambiguous; please use exact casing",
            )

    if not league:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid invite code",
        )

    # Lock the target league row so concurrent joins serialize before
    # capacity is checked and the membership row is inserted/reactivated.
    league = (
        db.query(League)
        .filter(League.id == league.id)
        .with_for_update()
        .first()
    )
    if not league:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="League not found",
        )

    is_setup_join = league.status == LeagueStatus.SETUP
    is_midseason_budget_join = (
        league.status == LeagueStatus.ACTIVE
        and not league.draft_mode
        and league.allow_midseason_join
    )
    if not is_setup_join and not is_midseason_budget_join:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This league is no longer accepting new members",
        )

    # Already a member?
    existing = (
        db.query(LeagueMembership)
        .filter(
            LeagueMembership.league_id == league.id,
            LeagueMembership.user_id == user.id,
        )
        .first()
    )
    if existing and existing.status == LeagueMembershipStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already a member of this league",
        )

    # Full?
    member_count = (
        db.query(func.count(LeagueMembership.id))
        .filter(LeagueMembership.league_id == league.id)
        .filter(LeagueMembership.status == LeagueMembershipStatus.ACTIVE)
        .scalar()
    )
    if member_count >= league.max_teams:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This league is full",
        )

    eligible_from_window_id = None
    if is_midseason_budget_join:
        now = datetime.now(timezone.utc)
        next_window = (
            db.query(TransferWindow)
            .filter(
                TransferWindow.season_id == league.season_id,
                _window_competition_clause(_league_window_competition(db, league)),
                TransferWindow.start_at > now,
            )
            .order_by(TransferWindow.start_at.asc())
            .first()
        )
        if not next_window:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No upcoming transfer window is available for late joiners",
            )
        # Only a genuinely late joiner gets an eligibility window. A league flips
        # to ACTIVE on its start date, which can be days before its first window
        # opens — someone joining in that gap has missed no scoring at all, and
        # stamping them as a midseason joiner hides them from the season
        # leaderboard until the window starts (standings_service filters on
        # eligibility_window.start_at <= now). Leaving it NULL keeps them
        # scoring from window 1 alongside everyone who joined during SETUP.
        season_has_started = db.query(
            db.query(TransferWindow)
            .filter(
                TransferWindow.season_id == league.season_id,
                _window_competition_clause(_league_window_competition(db, league)),
                TransferWindow.start_at <= now,
            )
            .exists()
        ).scalar()
        if season_has_started:
            eligible_from_window_id = next_window.id

    if existing:
        membership = existing
        membership.status = LeagueMembershipStatus.ACTIVE
        if eligible_from_window_id is not None:
            membership.eligible_from_window_id = eligible_from_window_id
    else:
        membership = LeagueMembership(
            league_id=league.id,
            user_id=user.id,
            eligible_from_window_id=eligible_from_window_id,
        )
        db.add(membership)

    team = (
        db.query(FantasyTeam)
        .filter(
            FantasyTeam.league_id == league.id,
            FantasyTeam.user_id == user.id,
        )
        .first()
    )
    if team and team.status == FantasyTeamStatus.ARCHIVED:
        active_roster_size = (
            db.query(func.count(TeamPlayer.id))
            .filter(
                TeamPlayer.fantasy_team_id == team.id,
                TeamPlayer.released_window_id.is_(None),
            )
            .scalar()
        )
        if (
            team.starting_budget != league.budget_per_team
            or team.starting_squad_size != league.squad_size
            or active_roster_size > league.squad_size
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Archived team no longer matches this league; rebuild required",
            )

    if team:
        team.status = FantasyTeamStatus.ACTIVE

    db.flush()

    # Re-load with user relationship for MembershipResponse serialisation
    return (
        db.query(LeagueMembership)
        .options(*_MEMBERSHIP_OPTIONS)
        .filter(LeagueMembership.id == membership.id)
        .first()
    )



def get_members(
    db: Session,
    league_id: uuid.UUID,
) -> list[LeagueMembership]:
    """Return all members of a league, ordered by join date."""
    _require_league(db, league_id)
    return (
        db.query(LeagueMembership)
        .options(*_MEMBERSHIP_OPTIONS)
        .filter(LeagueMembership.league_id == league_id)
        .order_by(LeagueMembership.joined_at)
        .all()
    )



def delete_league(
    db: Session,
    league_id: uuid.UUID,
    current_user: User,
    *,
    admin_override: bool = False,
) -> None:
    """Delete a league and all related data.

    Only the league owner can delete the league (admin_override=True bypasses
    this for platform-admin use — see app/admin/services.py). Related rows
    are removed via existing FK and ORM cascades.
    """
    league = _require_league(db, league_id)

    if not admin_override and league.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the league owner can delete this league",
        )

    db.delete(league)
    db.flush()



def _deactivate_membership(
    db: Session,
    league_id: uuid.UUID,
    membership: LeagueMembership,
) -> None:
    """Shared exit path for leave (self) and remove (kick by owner).

    Marks membership as LEFT and archives the user's team (if present).
    Team-scoped rows stay in place so the history can be restored on rejoin
    (join_league reactivates a LEFT membership).
    """
    team = (
        db.query(FantasyTeam)
        .filter(
            FantasyTeam.league_id == league_id,
            FantasyTeam.user_id == membership.user_id,
        )
        .first()
    )
    if team:
        team.status = FantasyTeamStatus.ARCHIVED

    membership.status = LeagueMembershipStatus.LEFT
    db.flush()



def leave_league(
    db: Session,
    league_id: uuid.UUID,
    current_user: User,
) -> None:
    """Leave a league for non-owner members."""
    league = _require_league(db, league_id)
    membership = _require_membership(db, league_id, current_user.id)

    if league.owner_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="League owner cannot leave the league",
        )

    _deactivate_membership(db, league_id, membership)



def remove_member(
    db: Session,
    league_id: uuid.UUID,
    membership_id: uuid.UUID,
    current_user: User,
) -> LeagueMembership:
    """Remove (kick) a member from the league. Caller must be the owner —
    enforced by the route's require_league_owner dependency.

    Guards:
      1. Membership must exist, be ACTIVE, and belong to this league.
      2. The owner cannot be kicked (they can only delete the league).
      3. Not during DRAFTING — draft_position ordering assumes every
         member picks, so removing one mid-draft would corrupt the snake
         order. Kick before the draft or after it completes.

    Returns the membership so the router can clear the kicked user's
    transfer session. Does NOT commit — caller owns the transaction.
    """
    league = _require_league(db, league_id)

    membership = (
        db.query(LeagueMembership)
        .filter(
            LeagueMembership.id == membership_id,
            LeagueMembership.league_id == league_id,
            LeagueMembership.status == LeagueMembershipStatus.ACTIVE,
        )
        .first()
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found in this league",
        )

    if membership.user_id == league.owner_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The league owner cannot be removed",
        )

    if league.status == LeagueStatus.DRAFTING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot remove a member while the draft is in progress",
        )

    _deactivate_membership(db, league_id, membership)
    return membership



# ═══════════════════════════════════════════════════════════════════════════════
# Section 5 — League sport & lineup slot management
# ═══════════════════════════════════════════════════════════════════════════════


def _current_season_for_sport(db: Session, sport_id: uuid.UUID) -> Season | None:
    """The season of `sport_id` running right now — the SQL equivalent of
    Season.is_current (a Python property, not a queryable column). Used to
    auto-resolve which season a sport maps to for a league (LeagueSport.
    season_id) at creation/add-sport time: see create_league and add_sport.
    Cross-sport scoring depends on every LeagueSport row having a resolved
    season (get_league_sport_season in app/services/scoring/window_locator.py)
    — callers here must hard-block rather than leave one unmapped.

    This also doubles as the multisport overlap gate: create_league/add_sport
    require EVERY sport in a multisport league — including the primary one —
    to independently pass this "current" check. Two ranges that both contain
    "today" necessarily overlap each other, so requiring every sport to be
    current is sufficient to guarantee all of them overlap; no separate
    date-range overlap computation is needed on top of it."""
    today = date.today()
    return (
        db.query(Season)
        .filter(
            Season.sport_id == sport_id,
            Season.is_active.is_(True),
            Season.start_date <= today,
            Season.end_date >= today,
        )
        .first()
    )


def add_sport(
    db: Session,
    league_id: uuid.UUID,
    sport_name: str,
) -> LeagueSport:
    """Attach a sport to a league (SETUP status only).

    Guards:
      1. League must be in SETUP status — can't add a sport mid-draft
         or mid-season.
      2. Sport must exist and be active.
      3. Sport must not already be attached to this league.

    Does NOT commit — caller owns the transaction.
    """
    league = _require_league(db, league_id)

    if league.status != LeagueStatus.SETUP:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Sports can only be added during SETUP",
        )

    # Adding a sport makes this a multisport league — same overlap gate as
    # create_league: the league's OWN season must be live right now too, not
    # just the sport being added (see _current_season_for_sport's docstring
    # for why "every sport current" is what guarantees they all overlap).
    if not league.season or not (league.season.start_date <= date.today() <= league.season.end_date):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Cannot add a sport: this league's own season isn't in progress "
                "right now — every sport in a multisport league must have a "
                "season live at the same time."
            ),
        )

    sport = (
        db.query(Sport)
        .filter(Sport.name == sport_name.strip().lower())
        .first()
    )
    if not sport:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sport '{sport_name}' not found",
        )

    if not sport.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Sport '{sport_name}' is currently disabled",
        )

    if sport.name not in SUPPORTED_LEAGUE_SPORTS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Sport '{sport_name}' is not supported",
        )

    existing = (
        db.query(LeagueSport)
        .filter(
            LeagueSport.league_id == league_id,
            LeagueSport.sport_id == sport.id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Sport '{sport_name}' is already attached to this league",
        )

    mapped_season = _current_season_for_sport(db, sport.id)
    if mapped_season is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot add '{sport_name}': no current season exists for it yet",
        )

    league_sport = LeagueSport(
        league_id=league_id,
        sport_id=sport.id,
        season_id=mapped_season.id,
    )
    db.add(league_sport)
    db.flush()

    # Re-load with sport relationship for LeagueSportResponse serialisation
    return (
        db.query(LeagueSport)
        .options(joinedload(LeagueSport.sport))
        .filter(
            LeagueSport.league_id == league_id,
            LeagueSport.sport_id == sport.id,
        )
        .first()
    )



def remap_sport_season(
    db: Session,
    league_id: uuid.UUID,
    sport_name: str,
    season_id: uuid.UUID,
) -> LeagueSport:
    """Re-point this league's LeagueSport.season_id for `sport_name` to a
    different season of that same sport.

    The real-world case this exists for: a sport's season gets created with
    placeholder dates (or a coincidentally-shared range with another sport),
    a league is built against it, and later an admin creates the sport's
    correctly-dated real season — existing leagues need to be moved onto it
    deliberately, not left silently pointing at the retired placeholder.

    Unlike add_sport/remove_sport this is NOT restricted to SETUP — the
    whole point is fixing a live league's cross-sport scoring mapping,
    which is exactly the case for an already-ACTIVE league.

    Guards:
      1. Sport must be attached to this league already.
      2. Sport must not be the league's OWN primary sport (League.season_id)
         — that one is set at creation/renewal, this endpoint only touches
         secondary sports' mappings, and remapping it here would silently
         do nothing (get_league_sport_season short-circuits on the primary
         sport via League.season_id, never reading LeagueSport.season_id
         for it).
      3. The new season must actually belong to `sport_name` — remapping to
         a different sport's season would corrupt scoring, not fix it.

    Does NOT commit — caller owns the transaction.
    """
    league = _require_league(db, league_id)

    sport = (
        db.query(Sport)
        .filter(Sport.name == sport_name.strip().lower())
        .first()
    )
    if not sport:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sport '{sport_name}' not found",
        )

    if league.season and league.season.sport_id == sport.id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"'{sport_name}' is this league's primary sport — its season is set via "
                "league creation or renewal, not this action"
            ),
        )

    league_sport = (
        db.query(LeagueSport)
        .filter(LeagueSport.league_id == league_id, LeagueSport.sport_id == sport.id)
        .first()
    )
    if not league_sport:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"'{sport_name}' is not attached to this league",
        )

    season = db.query(Season).filter(Season.id == season_id).first()
    if not season or season.sport_id != sport.id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"season_id must be a season of '{sport_name}'",
        )

    league_sport.season_id = season.id
    db.flush()

    return (
        db.query(LeagueSport)
        .options(joinedload(LeagueSport.sport), joinedload(LeagueSport.season))
        .filter(LeagueSport.league_id == league_id, LeagueSport.sport_id == sport.id)
        .first()
    )



def remove_sport(
    db: Session,
    league_id: uuid.UUID,
    sport_name: str,
) -> None:
    """Detach a sport from a league (SETUP status only).

    Guards:
      1. League must be in SETUP status.
      2. Sport must exist.
      3. Sport must actually be attached to this league.

    Does NOT commit — caller owns the transaction.
    """
    league = _require_league(db, league_id)

    if league.status != LeagueStatus.SETUP:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Sports can only be removed during SETUP",
        )

    sport = (
        db.query(Sport)
        .filter(Sport.name == sport_name.strip().lower())
        .first()
    )
    if not sport:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sport '{sport_name}' not found",
        )

    league_sport = (
        db.query(LeagueSport)
        .filter(
            LeagueSport.league_id == league_id,
            LeagueSport.sport_id == sport.id,
        )
        .first()
    )
    if not league_sport:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sport '{sport_name}' is not attached to this league",
        )

    db.delete(league_sport)
    db.flush()



def add_lineup_slot(
    db: Session,
    league_id: uuid.UUID,
    data: LineupSlotCreate,
) -> LineupSlot:
    """Define a position requirement for a league+sport combination.

    Example: league X, football → min 1 GKP, max 1 GKP.

    Guards:
      1. League must be in SETUP status.
      2. Sport must exist and be attached to the league.
      3. Position must not already be defined for this league+sport
         (the DB has a unique constraint, but catching it here gives
         a better error message than a 500 IntegrityError).

    Does NOT commit — caller owns the transaction.
    """
    league = _require_league(db, league_id)

    if league.status != LeagueStatus.SETUP:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Lineup slots can only be configured during SETUP",
        )

    sport = (
        db.query(Sport)
        .filter(Sport.name == data.sport_name)
        .first()
    )
    if not sport:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sport '{data.sport_name}' not found",
        )

    # Sport must be attached to the league
    sport_attached = (
        db.query(LeagueSport)
        .filter(
            LeagueSport.league_id == league_id,
            LeagueSport.sport_id == sport.id,
        )
        .first()
    )
    if not sport_attached:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Sport '{data.sport_name}' is not attached to this league",
        )

    # Duplicate position check
    existing = (
        db.query(LineupSlot)
        .filter(
            LineupSlot.league_id == league_id,
            LineupSlot.sport_id == sport.id,
            LineupSlot.position == data.position,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Position '{data.position}' is already defined "
                f"for sport '{data.sport_name}' in this league"
            ),
        )

    slot = LineupSlot(
        league_id=league_id,
        sport_id=sport.id,
        position=data.position,
        min_count=data.min_count,
        max_count=data.max_count,
    )
    db.add(slot)
    db.flush()

    # Re-load with sport relationship for LineupSlotResponse serialisation
    return (
        db.query(LineupSlot)
        .options(joinedload(LineupSlot.sport))
        .filter(LineupSlot.id == slot.id)
        .first()
    )



def _attach_midseason_join_info(
    db: Session, league: League, now: datetime | None = None
) -> None:
    """Compute and set the transient `joinable_now` / `midseason_entry_window_number`
    / `midseason_join_message` attributes on a League instance.

    Joinable means:
        - SETUP status (standard join flow), or
        - ACTIVE budget-mode with allow_midseason_join=True and at least
          one upcoming transfer window.
    Otherwise joinable_now is explicitly False (not left unset), so any
    endpoint serialising a League gets a definitive answer rather than
    the schema's None default.
    """
    now = now or datetime.now(timezone.utc)

    if league.status == LeagueStatus.SETUP:
        league.joinable_now = True
        league.midseason_entry_window_number = None
        league.midseason_join_message = "Join now. Build your team before kickoff."
        return

    if (
        league.status == LeagueStatus.ACTIVE
        and not league.draft_mode
        and league.allow_midseason_join
    ):
        next_window = (
            db.query(TransferWindow)
            .filter(
                TransferWindow.season_id == league.season_id,
                _window_competition_clause(_league_window_competition(db, league)),
                TransferWindow.start_at > now,
            )
            .order_by(TransferWindow.start_at.asc())
            .first()
        )
        if next_window:
            league.joinable_now = True
            league.midseason_entry_window_number = next_window.number
            league.midseason_join_message = (
                f"Join now. Your team starts scoring from transfer window {next_window.number}."
            )
            return

    league.joinable_now = False
    league.midseason_entry_window_number = None
    league.midseason_join_message = None



def discover_public_leagues(db: Session) -> list[League]:
    """Return public leagues that are currently joinable.

        Includes:
            - SETUP leagues (standard join flow)
            - ACTIVE budget-mode leagues with allow_midseason_join=True
                and at least one upcoming transfer window.

    Ordered by newest first so fresh leagues appear at the top.
    """
    now = datetime.now(timezone.utc)
    leagues = (
        db.query(League)
        .filter(
            League.is_public == True,
            or_(
                League.status == LeagueStatus.SETUP,
                and_(
                    League.status == LeagueStatus.ACTIVE,
                    League.draft_mode == False,
                    League.allow_midseason_join == True,
                ),
            ),
        )
        .options(*_LEAGUE_OPTIONS)
        .order_by(League.created_at.desc())
        .all()
    )

    filtered: list[League] = []
    for league in leagues:
        _attach_midseason_join_info(db, league, now=now)
        if league.joinable_now:
            filtered.append(league)

    return filtered



def update_midseason_join_setting(
    db: Session,
    league_id: uuid.UUID,
    allow_midseason_join: bool,
    current_user: User,
) -> League:
    """Toggle whether an active budget league accepts late joiners."""
    league = _require_league(db, league_id)

    if league.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the league owner can update this setting",
        )

    if league.draft_mode:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Mid-season joining is only available for budget leagues",
        )

    if allow_midseason_join and league.is_head_to_head:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Mid-season joining is not available for head-to-head leagues — "
                "the matchup schedule is locked once the season starts."
            ),
        )

    if league.status == LeagueStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot update mid-season joining for completed leagues",
        )

    league.allow_midseason_join = allow_midseason_join
    db.flush()
    return _require_league(db, league_id, eager=True)



def update_league_settings(
    db: Session,
    league_id: uuid.UUID,
    *,
    name: str | None = None,
    is_public: bool | None = None,
) -> League:
    """Apply a partial update to a league's editable settings (name, visibility).

    Owner authorization is enforced at the router via require_league_owner.
    Only non-None fields are applied. Does NOT commit — caller owns the
    transaction.
    """
    league = _require_league(db, league_id)

    if name is not None:
        league.name = name
    if is_public is not None:
        league.is_public = is_public

    db.flush()
    return _require_league(db, league_id, eager=True)



# ═══════════════════════════════════════════════════════════════════════════════
# Section 6 — Budget-mode specific functions
# ═══════════════════════════════════════════════════════════════════════════════


def build_initial_team(
    db: Session,
    league_id: uuid.UUID,
    team_name: str,
    player_ids: list[uuid.UUID],
    current_user: User,
) -> FantasyTeam:
    """Build initial team for a budget-mode league.
    
    Allows users to select their starting squad within budget constraints.
    Used for budget-mode leagues where there's no draft.

        Budget-mode ownership is shared across the league: another fantasy team
        can also own the same real-world player. The only ownership rule here is
        that a single fantasy team cannot include the same player twice.
    
    Guards:
      1. League must be budget-mode (draft_mode=False).
      2. League must be in SETUP or ACTIVE status (a member who never finished
         their squad before kickoff can still build one).
      3. User must be a member.
      4. User must not already have a team.
      5. All players must exist, be available, and belong to league sports.
      6. Players must not be duplicates.
      7. Total cost must not exceed budget_per_team.
      8. Number of players must match squad_size.
    
    Does NOT commit — caller owns the transaction.
    """
    league = _require_league(db, league_id)
    
    if league.draft_mode:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Team building is only for budget-mode leagues (use draft instead)",
        )
    
    # Verify membership
    membership = _require_membership(db, league_id, current_user.id)

    # A budget league flips SETUP->ACTIVE on its start date whether or not every
    # member finished their squad. Gating the build on eligible_from_window_id —
    # which only join_league()'s midseason path ever sets — permanently locked out
    # anyone who joined during SETUP and hadn't built yet. Any member without a
    # team may build while the league is still running; a NULL eligibility window
    # keeps them scoring from window 1, as if they had built before kickoff.
    if league.status not in (LeagueStatus.SETUP, LeagueStatus.ACTIVE):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Teams can only be built while the league is in setup or active",
        )

    # Check if team already exists
    existing_team = (
        db.query(FantasyTeam)
        .filter(
            FantasyTeam.league_id == league_id,
            FantasyTeam.user_id == current_user.id,
            FantasyTeam.status == FantasyTeamStatus.ACTIVE,
        )
        .first()
    )
    if existing_team:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You already have a team in this league",
        )
    
    # Derive sport type (needed for is_multisport_league flag used in team creation)
    sport_type = derive_sport_type(league.sports)
    is_multisport_league = sport_type == "mixed"

    # Fetch and validate all players exist
    players = (
        db.query(Player)
        .options(selectinload(Player.sport))
        .filter(Player.id.in_(player_ids))
        .all()
    )

    if len(players) != len(player_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or more players not found",
        )

    # Get league sports
    league_sport_records = db.query(Sport).join(
        LeagueSport, LeagueSport.sport_id == Sport.id
    ).filter(LeagueSport.league_id == league_id).all()
    league_sport_ids = {s.id for s in league_sport_records}

    if not league_sport_ids:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="League has no sports attached",
        )

    # Validate each player's availability and sport membership
    total_cost = Decimal("0.00")
    for player in players:
        if not player.is_available:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Player {player.name} is not available",
            )

        if player.sport_id not in league_sport_ids:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Player {player.name}'s sport is not part of this league",
            )

        total_cost += player.cost

    # ── Squad size, duplicate, and mixed-sport quota validation ─────────────
    try:
        validate_squad_size(players, league, sports=league_sport_records)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    # ── Position-slot validation (only when lineup slots are configured) ─────
    lineup_slots = (
        db.query(LineupSlot)
        .filter(LineupSlot.league_id == league_id)
        .all()
    )
    try:
        validate_position_slots(players, lineup_slots)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )

    # ── Position minimums + max-per-club ─────────────────────────────────────
    # Same check every other roster-mutating path runs (draft picks, transfers,
    # trades, waivers). Without it the budget-mode initial build was the one
    # entry point that accepted a squad the league's own rules reject — the
    # frontend showed the GKP/DEF/MID/FWD checklist while the API took 15
    # forwards from one club. LineupSlot rows are admin-created and almost
    # never exist, so validate_position_slots above returns immediately.
    violation = check_full_squad_constraints(
        players, league, sport_type, "mixed" if is_multisport_league else "single"
    )
    if violation:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=violation,
        )
    
    # Budget check
    if total_cost > league.budget_per_team:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Total cost {total_cost} exceeds budget {league.budget_per_team}",
        )
    
    # Get the acquisition window: the season's first window for a normal
    # SETUP-phase build, or the joiner's eligible-from window for a
    # midseason joiner (so acquisition history reflects when they actually
    # entered, not the season start).
    if membership.eligible_from_window_id is not None:
        first_window = (
            db.query(TransferWindow)
            .filter(TransferWindow.id == membership.eligible_from_window_id)
            .first()
        )
    else:
        first_window = (
            db.query(TransferWindow)
            .filter(
                TransferWindow.season_id == league.season_id,
                _window_competition_clause(_league_window_competition(db, league)),
            )
            .order_by(TransferWindow.number)
            .first()
        )
    if not first_window:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No transfer windows exist for this season",
        )

    # Create fantasy team
    team = FantasyTeam(
        league_id=league_id,
        user_id=current_user.id,
        name=team_name,
        current_budget=league.budget_per_team - total_cost,
        starting_budget=league.budget_per_team,
        starting_squad_size=league.squad_size,
    )
    db.add(team)
    db.flush()
    
    # Add all players to the team
    for player in players:
        db.add(
            BudgetTransaction(
                fantasy_team_id=team.id,
                player_id=player.id,
                transaction_type="purchase",
                amount=player.cost,
                penalty_applied=Decimal("0.00"),
            )
        )
        team_player = TeamPlayer(
            fantasy_team_id=team.id,
            league_id=league_id,
            is_draft=league.draft_mode,
            player_id=player.id,
            sport_type=player.sport.name,
            acquired_window_id=first_window.id,
            cost_at_acquisition=player.cost,
        )
        db.add(team_player)
    
    db.flush()
    logger.info(
        "Built initial team for user=%s in league=%s with %d players (total cost: %s)",
        current_user.id, league_id, len(players), total_cost
    )
    
    return team



def get_active_seasons(db: Session) -> list[Season]:
    """Return all active seasons for league creation: real single-sport seasons
    of supported sports, PLUS unified multisport seasons (sport_id IS NULL).

    Uses an OUTER join and an explicit `sport_id IS NULL` allowance — an inner
    join on Sport would silently drop every unified season (no sport row to
    match), hiding them from the create-league season picker."""
    return (
        db.query(Season)
        .outerjoin(Sport, Season.sport_id == Sport.id)
        .filter(Season.is_active.is_(True))
        .filter(or_(Sport.name.in_(SUPPORTED_LEAGUE_SPORTS), Season.sport_id.is_(None)))
        .order_by(Season.name.asc())
        .all()
    )



def get_active_sports(db: Session) -> list[Sport]:
    """Return all active sports available on the platform."""
    return (
        db.query(Sport)
        .filter(Sport.is_active.is_(True))
        .filter(Sport.name.in_(SUPPORTED_LEAGUE_SPORTS))
        .order_by(Sport.display_name.asc())
        .all()
    )



def get_active_transfer_window(db: Session, league_id: uuid.UUID) -> dict:
    """The in-progress window (containing now) — drives the live/standings
    display and scoring. For the window users EDIT, use the editable one."""
    league = _require_league(db, league_id)
    window = _current_transfer_window(db, league)
    total_windows = _league_window_total(db, league)
    return _serialize_window(window, total_windows)



def get_editable_transfer_window(db: Session, league_id: uuid.UUID) -> dict:
    """The gameweek you can currently SET UP (the next not-yet-locked window) —
    drives the lineup + transfers pages, which edit the upcoming gameweek while
    the current one plays."""
    league = _require_league(db, league_id)
    window = _editable_transfer_window(db, league)
    total_windows = _league_window_total(db, league)
    return _serialize_window(window, total_windows)



def get_league_season_state(db: Session, league_id: uuid.UUID) -> dict:
    """Non-raising season-phase summary for a league — drives the pre-season /
    team-building UI so the frontend never has to infer state from a 409 or a
    hardcoded gameweek total.

    phase:
      PRE_SEASON        — no window has started yet (team-building; no real
                          matches played). first_deadline_at is GW1's deadline.
      LIVE              — a gameweek is in progress right now.
      BETWEEN_GAMEWEEKS — season underway but no gameweek live at this instant.
      COMPLETED         — the last gameweek has ended.
    """
    league = _require_league(db, league_id)
    now = datetime.now(timezone.utc)
    comp = _window_competition_clause(_league_window_competition(db, league))
    base = db.query(TransferWindow).filter(
        TransferWindow.season_id == league.season_id, comp
    )
    total = _league_window_total(db, league)
    first = base.order_by(TransferWindow.start_at.asc()).first()
    last = base.order_by(TransferWindow.start_at.desc()).first()

    if first is None:
        return {
            "phase": "PRE_SEASON", "current_gw": 0, "total_gw": 0,
            "season_start_at": None, "first_deadline_at": None, "next_deadline_at": None,
        }

    active = base.filter(
        TransferWindow.start_at <= now, TransferWindow.end_at >= now
    ).order_by(TransferWindow.number.desc()).first()
    editable = base.filter(TransferWindow.lineup_deadline_at > now).order_by(
        TransferWindow.start_at.asc()
    ).first()

    if now < first.start_at:
        phase, current_gw = "PRE_SEASON", 0
    elif last is not None and now > last.end_at:
        phase, current_gw = "COMPLETED", last.number
    elif active is not None:
        phase, current_gw = "LIVE", active.number
    else:
        phase = "BETWEEN_GAMEWEEKS"
        last_ended = base.filter(TransferWindow.end_at < now).order_by(
            TransferWindow.number.desc()
        ).first()
        current_gw = last_ended.number if last_ended else 0

    return {
        "phase": phase,
        "current_gw": current_gw,
        "total_gw": total,
        "season_start_at": first.start_at,
        "first_deadline_at": first.transfer_deadline_at,
        "next_deadline_at": editable.transfer_deadline_at if editable else None,
    }



def get_dashboard_stats(
    db: Session,
    league_id: uuid.UUID,
    user_id: uuid.UUID,
) -> dict:
    """Return league-scoped dashboard KPIs for the authenticated user's team."""
    league = _require_league(db, league_id)
    team = _require_fantasy_team(db, league_id, user_id)

    now = datetime.now(timezone.utc)
    active_window = None
    if league.season_id:
        active_window = (
            db.query(TransferWindow)
            .filter(
                TransferWindow.season_id == league.season_id,
                _window_competition_clause(_league_window_competition(db, league)),
                TransferWindow.start_at <= now,
                TransferWindow.end_at >= now,
            )
            .order_by(TransferWindow.number.desc())
            .first()
        )

    # Per-gameweek history: one row per window this team has been scored in,
    # ordered by gameweek number. The dashboard renders this directly; the
    # active-window points and the all-time total are both derived from it.
    weekly_rows = (
        db.query(
            TransferWindow.number.label("gameweek"),
            TeamWeeklyScore.transfer_window_id.label("transfer_window_id"),
            TeamWeeklyScore.points.label("points"),
            TeamWeeklyScore.rank_in_league.label("rank"),
        )
        .join(
            TransferWindow,
            TransferWindow.id == TeamWeeklyScore.transfer_window_id,
        )
        .filter(TeamWeeklyScore.fantasy_team_id == team.id)
        .order_by(TransferWindow.number.asc())
        .all()
    )

    # Budget-overage points penalties, netted out at read time — same
    # approach as standings_service.py's leaderboard query. TeamWeeklyScore.points
    # stays untouched; the deduction is applied here and surfaced separately
    # as points_deducted so the UI can show a "X points deducted" note.
    penalty_by_window: dict[uuid.UUID, Decimal] = {
        row.transfer_window_id: row.charged
        for row in (
            db.query(
                PointsPenalty.transfer_window_id.label("transfer_window_id"),
                func.sum(PointsPenalty.points_charged).label("charged"),
            )
            .filter(PointsPenalty.fantasy_team_id == team.id)
            .group_by(PointsPenalty.transfer_window_id)
            .all()
        )
    }

    # Multisport leagues run one TransferWindow chain per sport, each numbered
    # independently from 1 — so football window #7 and basketball window #7
    # both surface as "gameweek 7" here. Merge same-numbered windows into one
    # row (summing points) so the UI shows one GW7, not one per sport.
    by_gameweek: dict[int, dict] = {}
    for row in weekly_rows:
        deducted = penalty_by_window.get(row.transfer_window_id, Decimal("0"))
        entry = by_gameweek.setdefault(
            row.gameweek,
            {
                "gameweek": row.gameweek,
                "transfer_window_id": row.transfer_window_id,
                "points": Decimal("0"),
                "points_deducted": Decimal("0"),
                "rank": None,
            },
        )
        entry["points"] += row.points - deducted
        entry["points_deducted"] += deducted
        if row.rank is not None and (entry["rank"] is None or row.rank < entry["rank"]):
            entry["rank"] = row.rank
    gameweek_breakdown = sorted(by_gameweek.values(), key=lambda r: r["gameweek"])

    gameweek_points: Decimal | None = None
    gameweek_points_deducted = Decimal("0")
    rank: int | None = None
    if active_window:
        active = by_gameweek.get(active_window.number)
        if active:
            gameweek_points = active["points"]
            gameweek_points_deducted = active["points_deducted"]
            rank = active["rank"]

    total_points_deducted = sum(penalty_by_window.values(), Decimal("0"))
    total_points = (
        sum((row.points for row in weekly_rows), Decimal("0")) - total_points_deducted
    )

    return {
        "league_id": league_id,
        "team_id": team.id,
        "rank": rank,
        "gameweek_points": gameweek_points,
        "gameweek_points_deducted": gameweek_points_deducted,
        "total_points": total_points,
        "points_deducted": total_points_deducted,
        "budget": team.current_budget,
        "gameweek_breakdown": gameweek_breakdown,
    }

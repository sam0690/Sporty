from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import timedelta
from decimal import Decimal

from sqlalchemy import and_, func, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, aliased

from app.league.models import (
    FantasyTeam,
    LeagueMembershipStatus,
    LeagueMembership,
    LeagueSport,
    LineupSlot,
    Sport,
    TeamGameweekLineup,
    TeamWeeklyScore,
    TransferWindow,
)
from app.match.models import Match
from app.player.models import Player, PlayerGameweekStat
from app.services.scoring.auto_subs import LineupPlayer, resolve_effective_lineup
from app.services.scoring.window_locator import find_equivalent_window_for_sport
from app.services.sync.football_competitions import FOOTBALL_COMPETITIONS


def apply_captain_vice_bonus(
    *,
    base_points: Decimal,
    captain_points: Decimal | None,
    captain_minutes: int | None,
    vice_points: Decimal | None,
    vice_minutes: int | None,
) -> Decimal:
    # Algorithm: if captain played add captain points; else if captain DNP and vice played add vice points; else add 0.
    if captain_points is not None and (captain_minutes or 0) > 0:
        return base_points + captain_points
    if (captain_minutes or 0) == 0 and vice_points is not None and (vice_minutes or 0) > 0:
        return base_points + vice_points
    return base_points


# ── Data shapes shared by scoring + the gameweek recap ─────────────────────────


@dataclass
class LineupRow:
    """One team_gameweek_lineups row enriched with the player's gameweek stat."""

    player_id: uuid.UUID
    sport_id: uuid.UUID | None
    position: str | None
    is_starter: bool
    bench_order: int | None
    is_captain: bool
    is_vice_captain: bool
    minutes_played: int
    points: Decimal


@dataclass
class PlayerGameweekLine:
    """Per-player breakdown for the recap view."""

    player_id: uuid.UUID
    is_starter: bool
    is_captain: bool
    is_vice_captain: bool
    bench_order: int | None
    minutes_played: int
    points: Decimal          # raw player points for the window
    counted: bool            # part of the effective scoring XI
    status: str              # played | did_not_play | not_yet_played | subbed_in | subbed_out | benched
    captain_bonus: Decimal   # extra points this player contributed via the (C)/(V) rule


@dataclass
class TeamGameweekResult:
    fantasy_team_id: uuid.UUID
    base_points: Decimal = Decimal("0")
    captain_vice_bonus: Decimal = Decimal("0")
    total_points: Decimal = Decimal("0")
    players: list[PlayerGameweekLine] = field(default_factory=list)


def _position_key(sport_id: uuid.UUID | None, position: str | None):
    if sport_id is None or not position:
        return None
    return (sport_id, position.strip().upper())


def resolve_team_gameweek(
    fantasy_team_id: uuid.UUID,
    rows: list[LineupRow],
    slot_bounds: dict,
    *,
    window_has_played: bool = True,
    apply_auto_subs: bool = True,
) -> TeamGameweekResult:
    """Pure resolution of a single team's gameweek: run auto-subs over the
    starters/bench, apply the captain/vice rule, and produce the per-player
    breakdown used by both scoring and the recap endpoint.

    ``window_has_played=False`` means the gameweek hasn't happened yet, so
    every ``PlayerGameweekStat`` is absent rather than genuinely zero — skip
    auto-subs/scoring entirely and report starters as "not_yet_played" instead
    of the (indistinguishable-looking) "did_not_play".

    ``apply_auto_subs=False`` means the gameweek has started but isn't over:
    points, captain/vice and statuses still resolve, but nobody comes off the
    bench, because a starter on 0 minutes may simply not have kicked off yet
    (see ``window_fixtures_complete``)."""
    if not window_has_played:
        players = [
            PlayerGameweekLine(
                player_id=r.player_id,
                is_starter=r.is_starter,
                is_captain=r.is_captain,
                is_vice_captain=r.is_vice_captain,
                bench_order=r.bench_order,
                minutes_played=r.minutes_played,
                points=r.points,
                counted=False,
                status="not_yet_played" if r.is_starter else "benched",
                captain_bonus=Decimal("0"),
            )
            for r in rows
        ]
        return TeamGameweekResult(
            fantasy_team_id=fantasy_team_id,
            base_points=Decimal("0"),
            captain_vice_bonus=Decimal("0"),
            total_points=Decimal("0"),
            players=players,
        )

    starters_rows = [r for r in rows if r.is_starter]
    bench_rows = sorted(
        (r for r in rows if not r.is_starter),
        key=lambda r: (r.bench_order if r.bench_order is not None else 1_000),
    )

    starters = [
        LineupPlayer(
            player_id=r.player_id,
            position_key=_position_key(r.sport_id, r.position),
            minutes_played=r.minutes_played,
            points=r.points,
        )
        for r in starters_rows
    ]
    bench = [
        LineupPlayer(
            player_id=r.player_id,
            position_key=_position_key(r.sport_id, r.position),
            minutes_played=r.minutes_played,
            points=r.points,
            bench_order=r.bench_order,
        )
        for r in bench_rows
    ]

    # An empty bench makes substitution impossible; everything else resolves
    # exactly as it would with one.
    sub = resolve_effective_lineup(starters, bench if apply_auto_subs else [], slot_bounds)

    # Captain / vice-captain bonus (both are always starters).
    captain = next((r for r in starters_rows if r.is_captain), None)
    vice = next((r for r in starters_rows if r.is_vice_captain), None)
    base = sub.base_points
    total = apply_captain_vice_bonus(
        base_points=base,
        captain_points=captain.points if captain else None,
        captain_minutes=captain.minutes_played if captain else None,
        vice_points=vice.points if vice else None,
        vice_minutes=vice.minutes_played if vice else None,
    )
    bonus = total - base

    # Attribute the bonus to whichever armband actually earned it.
    bonus_player_id: uuid.UUID | None = None
    if captain and captain.minutes_played > 0:
        bonus_player_id = captain.player_id
    elif captain and captain.minutes_played == 0 and vice and vice.minutes_played > 0:
        bonus_player_id = vice.player_id

    players: list[PlayerGameweekLine] = []
    for r in rows:
        counted = r.player_id in sub.effective_ids
        if r.player_id in sub.subbed_out:
            status = "subbed_out"
        elif r.player_id in sub.subbed_in:
            status = "subbed_in"
        elif r.is_starter:
            status = "played" if r.minutes_played > 0 else "did_not_play"
        else:
            status = "benched"
        players.append(
            PlayerGameweekLine(
                player_id=r.player_id,
                is_starter=r.is_starter,
                is_captain=r.is_captain,
                is_vice_captain=r.is_vice_captain,
                bench_order=r.bench_order,
                minutes_played=r.minutes_played,
                points=r.points,
                counted=counted,
                status=status,
                captain_bonus=bonus if r.player_id == bonus_player_id else Decimal("0"),
            )
        )

    return TeamGameweekResult(
        fantasy_team_id=fantasy_team_id,
        base_points=base,
        captain_vice_bonus=bonus,
        total_points=total,
        players=players,
    )


def load_slot_bounds(db: Session, league_id: uuid.UUID) -> dict:
    """position_key (sport_id, POSITION) -> (min_count, max_count) for a league."""
    rows = db.execute(
        select(
            LineupSlot.sport_id,
            LineupSlot.position,
            LineupSlot.min_count,
            LineupSlot.max_count,
        ).where(LineupSlot.league_id == league_id)
    ).all()
    return {
        (sport_id, position.strip().upper()): (int(min_c), int(max_c))
        for sport_id, position, min_c, max_c in rows
    }


def window_fixtures_complete(
    db: Session,
    *,
    league_id: uuid.UUID,
    window: TransferWindow,
) -> bool:
    """True once every fixture this league's gameweek depends on has been
    played out — the gate for auto-substitutions.

    Auto-subs read "0 minutes" as "did not play", which is only true once the
    player's fixture is over. Run mid-gameweek they replace starters whose
    match simply hasn't kicked off yet, so every standing is wrong until the
    week ends and scoring recomputes from scratch. FPL runs them at gameweek
    end for the same reason.

    ``postponed``/``cancelled`` count as played out — otherwise one shelved
    fixture blocks the gameweek's auto-subs forever.
    """
    sport_ids = [
        sport_id
        for (sport_id,) in db.query(LeagueSport.sport_id).filter(
            LeagueSport.league_id == league_id
        )
    ]
    # A per-competition window (EPL/LALIGA/…) only waits on its own
    # competition's fixtures; a combined (NULL) window waits on every fantasy
    # one. Non-football sports carry names outside this registry and are never
    # filtered out here — only sibling football competitions are.
    awaited = (
        {c.name for c in FOOTBALL_COMPETITIONS.values() if c.tag == window.competition}
        if window.competition
        else {c.name for c in FOOTBALL_COMPETITIONS.values() if c.fantasy}
    )
    ignored = [c.name for c in FOOTBALL_COMPETITIONS.values() if c.name not in awaited]

    # ponytail: a multisport league checks its other sports against THIS
    # window's date range rather than each sport's own equivalent window —
    # fine while both schedules are aligned weekly spans; swap in
    # find_equivalent_window_for_sport per sport if they ever diverge.
    q = db.query(Match.id).filter(
        Match.match_date >= window.start_at,
        Match.match_date < window.end_at,
        Match.status.in_(("scheduled", "live")),
        # A fixture that kicked off hours ago and still isn't marked finished
        # is a stalled sync, not a game in progress — don't let it hold the
        # gameweek's auto-subs open forever.
        Match.match_date >= func.now() - timedelta(hours=6),
    )
    if ignored:
        q = q.filter(Match.competition.notin_(ignored))
    if sport_ids:
        q = q.filter(Match.sport_id.in_(sport_ids))
    return q.first() is None


def _eligible_team_ids(
    db: Session,
    *,
    league_id: uuid.UUID,
    current_window_number: int,
) -> list[uuid.UUID]:
    eligibility_window = aliased(TransferWindow)
    rows = db.execute(
        select(FantasyTeam.id)
        .join(
            LeagueMembership,
            and_(
                LeagueMembership.league_id == FantasyTeam.league_id,
                LeagueMembership.user_id == FantasyTeam.user_id,
            ),
        )
        .outerjoin(
            eligibility_window,
            LeagueMembership.eligible_from_window_id == eligibility_window.id,
        )
        .where(FantasyTeam.league_id == league_id)
        .where(LeagueMembership.status == LeagueMembershipStatus.ACTIVE)
        .where(
            or_(
                LeagueMembership.eligible_from_window_id.is_(None),
                eligibility_window.number <= current_window_number,
            )
        )
    ).all()
    return [team_id for (team_id,) in rows]


def load_team_lineup_rows(
    db: Session,
    *,
    league_id: uuid.UUID,
    team_ids: list[uuid.UUID],
    transfer_window_id: uuid.UUID,
) -> dict[uuid.UUID, list[LineupRow]]:
    """Load every team's lineup for the window, enriched with each player's
    position and gameweek stat, grouped by fantasy_team_id."""
    if not team_ids:
        return {}

    # A multisport league's lineup rows all carry ONE window id (whichever
    # sport the league's season_id points to), including for players of the
    # league's OTHER sports — but those sports book PlayerGameweekStat under
    # THAT league's own resolved season for each sport (LeagueSport.season_id
    # — see get_league_sport_season). Translate per player's sport to that
    # league-specific equivalent window instead of assuming the lineup's
    # stored window id applies to every player directly.
    window = db.query(TransferWindow).filter(TransferWindow.id == transfer_window_id).first()
    if window is None:
        return {}

    sport_window_ids: dict[uuid.UUID, uuid.UUID] = {}
    for (sport_id,) in db.query(Sport.id).all():
        equivalent = find_equivalent_window_for_sport(
            db, league_id=league_id, window=window, sport_id=sport_id
        )
        if equivalent is not None:
            sport_window_ids[sport_id] = equivalent.id

    stat_match_conditions = [
        and_(Player.sport_id == sport_id, PlayerGameweekStat.transfer_window_id == window_id)
        for sport_id, window_id in sport_window_ids.items()
    ]
    stat_match = or_(*stat_match_conditions) if stat_match_conditions else False

    rows = db.execute(
        select(
            TeamGameweekLineup.fantasy_team_id,
            TeamGameweekLineup.player_id,
            Player.sport_id,
            Player.position,
            TeamGameweekLineup.is_starter,
            TeamGameweekLineup.bench_order,
            TeamGameweekLineup.is_captain,
            TeamGameweekLineup.is_vice_captain,
            func.coalesce(PlayerGameweekStat.minutes_played, 0),
            func.coalesce(PlayerGameweekStat.fantasy_points, Decimal("0")),
        )
        .join(Player, Player.id == TeamGameweekLineup.player_id)
        .outerjoin(
            PlayerGameweekStat,
            and_(PlayerGameweekStat.player_id == TeamGameweekLineup.player_id, stat_match),
        )
        .where(TeamGameweekLineup.fantasy_team_id.in_(team_ids))
        .where(TeamGameweekLineup.transfer_window_id == transfer_window_id)
    ).all()

    grouped: dict[uuid.UUID, list[LineupRow]] = {}
    for (
        fantasy_team_id,
        player_id,
        sport_id,
        position,
        is_starter,
        bench_order,
        is_captain,
        is_vice_captain,
        minutes_played,
        points,
    ) in rows:
        grouped.setdefault(fantasy_team_id, []).append(
            LineupRow(
                player_id=player_id,
                sport_id=sport_id,
                position=position,
                is_starter=bool(is_starter),
                bench_order=bench_order,
                is_captain=bool(is_captain),
                is_vice_captain=bool(is_vice_captain),
                minutes_played=int(minutes_played or 0),
                points=Decimal(points or 0),
            )
        )
    return grouped


def upsert_team_weekly_scores(
    db: Session,
    *,
    league_id: uuid.UUID,
    transfer_window_id: uuid.UUID,
) -> int:
    """Compute and persist each eligible team's total for the window.

    Scoring uses the starting lineup only, with formation-aware auto-substitution
    of bench players for starters who played 0 minutes, then the captain/vice
    bonus. Runs per-team in Python (the constraint-aware sub logic can't be a
    single SQL statement) and bulk-upserts team_weekly_scores.
    """
    window = (
        db.query(TransferWindow).filter(TransferWindow.id == transfer_window_id).first()
    )
    if window is None:
        return 0

    team_ids = _eligible_team_ids(
        db, league_id=league_id, current_window_number=window.number
    )
    if not team_ids:
        return 0

    slot_bounds = load_slot_bounds(db, league_id)
    lineups_by_team = load_team_lineup_rows(
        db, league_id=league_id, team_ids=team_ids, transfer_window_id=transfer_window_id
    )
    apply_auto_subs = window_fixtures_complete(db, league_id=league_id, window=window)

    values = []
    for team_id in team_ids:
        rows = lineups_by_team.get(team_id, [])
        if rows:
            result = resolve_team_gameweek(
                team_id, rows, slot_bounds, apply_auto_subs=apply_auto_subs
            )
            total = result.total_points
        else:
            total = Decimal("0")
        values.append(
            {
                "id": uuid.uuid4(),
                "fantasy_team_id": team_id,
                "transfer_window_id": transfer_window_id,
                "points": total,
                "rank_in_league": None,
            }
        )

    if not values:
        return 0

    insert_stmt = insert(TeamWeeklyScore).values(values)
    upsert_stmt = insert_stmt.on_conflict_do_update(
        index_elements=[
            TeamWeeklyScore.fantasy_team_id,
            TeamWeeklyScore.transfer_window_id,
        ],
        set_={
            "points": insert_stmt.excluded.points,
            "rank_in_league": None,
            # Explicit because ON CONFLICT DO UPDATE bypasses the column's
            # onupdate — without this the timestamp would freeze at the row's
            # first insert and answer nothing.
            "updated_at": func.now(),
        },
    )
    result = db.execute(upsert_stmt)
    return int(result.rowcount or 0)

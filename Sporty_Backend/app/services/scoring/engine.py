from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Iterable

from sqlalchemy import Numeric, and_, case, cast, func, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.league.models import FantasyTeam, League, LeagueSport, Sport, TeamGameweekLineup, TeamWeeklyScore, TransferWindow
from app.player.models import CricketStat, FootballStat, Player, PlayerGameweekStat
from app.player.models_nba import NBAStat
from app.scoring.models import DefaultScoringRule, LeagueScoringOverride

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# Constants (action keys must match requirement)
# ──────────────────────────────────────────────────────────────────────────────

FOOTBALL_ACTIONS = {
    "football_goal": Decimal("5"),
    "football_assist": Decimal("3"),
    "football_yellow_card": Decimal("-1"),
    "football_red_card": Decimal("-2"),
}

CRICKET_ACTIONS = [
    "cricket_run",
    "cricket_wicket",
    "cricket_catch",
    "cricket_run_out",
    "cricket_maiden",
]

NBA_ACTIONS = [
    "nba_points_10",
    "nba_assists_10",
    "nba_rebound",
    "nba_steal",
    "nba_block",
]


@dataclass(frozen=True)
class EffectiveRules:
    league_id: uuid.UUID
    sport_id: uuid.UUID
    points_by_action: dict[str, Decimal]


def _decimal(value: object, default: Decimal = Decimal("0")) -> Decimal:
    if value is None:
        return default
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def resolve_effective_rules(
    db: Session,
    *,
    league_id: uuid.UUID,
    sport_id: uuid.UUID,
    actions: Iterable[str],
    fallback_points: dict[str, Decimal] | None = None,
) -> EffectiveRules:
    """Resolve effective scoring points for a (league, sport).

    Rule resolution:
      effective_points(action) = override.points if exists else default.points

    If defaults are missing for an action, we optionally fall back to
    `fallback_points` (used for football fixed defaults).
    """

    action_list = [a for a in actions]
    if not action_list:
        return EffectiveRules(league_id=league_id, sport_id=sport_id, points_by_action={})

    defaults = (
        db.query(DefaultScoringRule.action, DefaultScoringRule.points)
        .filter(
            DefaultScoringRule.sport_id == sport_id,
            DefaultScoringRule.action.in_(action_list),
        )
        .all()
    )
    default_map = {action: _decimal(points) for action, points in defaults}

    overrides = (
        db.query(LeagueScoringOverride.action, LeagueScoringOverride.points)
        .filter(
            LeagueScoringOverride.league_id == league_id,
            LeagueScoringOverride.sport_id == sport_id,
            LeagueScoringOverride.action.in_(action_list),
        )
        .all()
    )
    override_map = {action: _decimal(points) for action, points in overrides}

    effective: dict[str, Decimal] = {}
    for action in action_list:
        if action in override_map:
            effective[action] = override_map[action]
        elif action in default_map:
            effective[action] = default_map[action]
        elif fallback_points and action in fallback_points:
            effective[action] = fallback_points[action]
        else:
            effective[action] = Decimal("0")

    return EffectiveRules(league_id=league_id, sport_id=sport_id, points_by_action=effective)


def score_football_players_for_window(
    db: Session,
    *,
    league_id: uuid.UUID,
    sport_id: uuid.UUID,
    transfer_window_id: uuid.UUID,
) -> int:
    """Compute PlayerGameweekStat.fantasy_points for football players.

    Updates only rows in the transfer window that have a FootballStat child.
    Does not modify minutes_played.
    """

    rules = resolve_effective_rules(
        db,
        league_id=league_id,
        sport_id=sport_id,
        actions=FOOTBALL_ACTIONS.keys(),
        fallback_points=FOOTBALL_ACTIONS,
    )

    pts_goal = rules.points_by_action["football_goal"]
    pts_assist = rules.points_by_action["football_assist"]
    pts_yellow = rules.points_by_action["football_yellow_card"]
    pts_red = rules.points_by_action["football_red_card"]

    pgs = PlayerGameweekStat.__table__
    fs = FootballStat.__table__
    players = Player.__table__

    # Postgres UPDATE .. FROM (explicit and reliable)
    stmt = (
        update(pgs)
        .where(pgs.c.id == fs.c.base_stat_id)
        .where(pgs.c.transfer_window_id == transfer_window_id)
        .where(pgs.c.player_id == players.c.id)
        .where(players.c.sport_id == sport_id)
        .values(
            fantasy_points=(
                (func.coalesce(fs.c.goals, 0) * pts_goal)
                + (func.coalesce(fs.c.assists, 0) * pts_assist)
                + (func.coalesce(fs.c.yellow_cards, 0) * pts_yellow)
                + (func.coalesce(fs.c.red_cards, 0) * pts_red)
            )
        )
        .execution_options(synchronize_session=False)
    )

    result = db.execute(stmt)
    return int(result.rowcount or 0)


def score_cricket_players_for_window(
    db: Session,
    *,
    league_id: uuid.UUID,
    sport_id: uuid.UUID,
    transfer_window_id: uuid.UUID,
) -> int:
    """Compute PlayerGameweekStat.fantasy_points for cricket players.

    Uses DB-configurable actions (defaults + overrides). Treats NULLs as 0.
    """

    rules = resolve_effective_rules(
        db,
        league_id=league_id,
        sport_id=sport_id,
        actions=CRICKET_ACTIONS,
    )

    run = rules.points_by_action["cricket_run"]
    wicket = rules.points_by_action["cricket_wicket"]
    catch = rules.points_by_action["cricket_catch"]
    run_out = rules.points_by_action["cricket_run_out"]
    maiden = rules.points_by_action["cricket_maiden"]

    pgs = PlayerGameweekStat.__table__
    cs = CricketStat.__table__
    players = Player.__table__

    # Postgres UPDATE .. FROM (explicit and reliable)
    stmt = (
        update(pgs)
        .where(pgs.c.id == cs.c.base_stat_id)
        .where(pgs.c.transfer_window_id == transfer_window_id)
        .where(pgs.c.player_id == players.c.id)
        .where(players.c.sport_id == sport_id)
        .values(
            fantasy_points=(
                (func.coalesce(cs.c.runs_scored, 0) * run)
                + (func.coalesce(cs.c.wickets_taken, 0) * wicket)
                + (func.coalesce(cs.c.catches, 0) * catch)
                + (func.coalesce(cs.c.run_outs, 0) * run_out)
                + (func.coalesce(cs.c.maidens, 0) * maiden)
            )
        )
        .execution_options(synchronize_session=False)
    )

    result = db.execute(stmt)
    return int(result.rowcount or 0)


def score_nba_players_for_window(
    db: Session,
    *,
    league_id: uuid.UUID,
    sport_id: uuid.UUID,
    transfer_window_id: uuid.UUID,
) -> int:
    """Compute PlayerGameweekStat.fantasy_points for NBA (basketball) players.

    Rule keys:
      - nba_points_10   (every 10 points, fractional allowed)
      - nba_assists_10  (every 10 assists, fractional allowed)
      - nba_rebound
      - nba_steal
      - nba_block
    """

    rules = resolve_effective_rules(
        db,
        league_id=league_id,
        sport_id=sport_id,
        actions=NBA_ACTIONS,
    )

    pts_points_10 = rules.points_by_action["nba_points_10"]
    pts_assists_10 = rules.points_by_action["nba_assists_10"]
    pts_rebound = rules.points_by_action["nba_rebound"]
    pts_steal = rules.points_by_action["nba_steal"]
    pts_block = rules.points_by_action["nba_block"]

    pgs = PlayerGameweekStat.__table__
    ns = NBAStat.__table__
    players = Player.__table__

    points_num = cast(func.coalesce(ns.c.points, 0), Numeric)
    assists_num = cast(func.coalesce(ns.c.assists, 0), Numeric)

    stmt = (
        update(pgs)
        .where(pgs.c.id == ns.c.base_stat_id)
        .where(pgs.c.transfer_window_id == transfer_window_id)
        .where(pgs.c.player_id == players.c.id)
        .where(players.c.sport_id == sport_id)
        .values(
            fantasy_points=(
                ((points_num / 10) * pts_points_10)
                + ((assists_num / 10) * pts_assists_10)
                + (func.coalesce(ns.c.rebounds, 0) * pts_rebound)
                + (func.coalesce(ns.c.steals, 0) * pts_steal)
                + (func.coalesce(ns.c.blocks, 0) * pts_block)
            )
        )
        .execution_options(synchronize_session=False)
    )

    result = db.execute(stmt)
    return int(result.rowcount or 0)


def _compute_team_points_vice_if_captain_dnp(
    *,
    base_points: Decimal,
    captain_points: Decimal | None,
    captain_minutes: int | None,
    vice_points: Decimal | None,
    vice_minutes: int | None,
) -> Decimal:
    """Captain rule Option A: vice_if_captain_dnp."""

    if captain_points is not None and (captain_minutes or 0) > 0:
        return base_points + captain_points

    if (captain_minutes or 0) == 0 and vice_points is not None and (vice_minutes or 0) > 0:
        return base_points + vice_points

    return base_points


def upsert_team_weekly_scores_and_ranks(
    db: Session,
    *,
    league_id: uuid.UUID,
    transfer_window_id: uuid.UUID,
) -> None:
    """Compute and upsert TeamWeeklyScore.points and set rank_in_league.

    Captain rule implemented: vice_if_captain_dnp.
    Ranking: points DESC; ties share the same rank (RANK() semantics).
    """

    team_ids = [
        team_id
        for (team_id,) in (
            db.query(FantasyTeam.id)
            .filter(FantasyTeam.league_id == league_id)
            .all()
        )
    ]

    if not team_ids:
        return

    # One query to pull all lineup rows for these teams in this window.
    lineup_rows = (
        db.query(
            TeamGameweekLineup.fantasy_team_id,
            TeamGameweekLineup.is_captain,
            TeamGameweekLineup.is_vice_captain,
            PlayerGameweekStat.minutes_played,
            PlayerGameweekStat.fantasy_points,
        )
        .outerjoin(
            PlayerGameweekStat,
            and_(
                PlayerGameweekStat.player_id == TeamGameweekLineup.player_id,
                PlayerGameweekStat.transfer_window_id == TeamGameweekLineup.transfer_window_id,
            ),
        )
        .filter(TeamGameweekLineup.fantasy_team_id.in_(team_ids))
        .filter(TeamGameweekLineup.transfer_window_id == transfer_window_id)
        .all()
    )

    points_by_team: dict[uuid.UUID, Decimal] = {tid: Decimal("0") for tid in team_ids}
    captain_by_team: dict[uuid.UUID, tuple[Decimal, int] | None] = {tid: None for tid in team_ids}
    vice_by_team: dict[uuid.UUID, tuple[Decimal, int] | None] = {tid: None for tid in team_ids}

    for team_id, is_captain, is_vice, minutes_played, fantasy_points in lineup_rows:
        p = _decimal(fantasy_points)
        m = int(minutes_played or 0)
        points_by_team[team_id] = points_by_team.get(team_id, Decimal("0")) + p

        if is_captain:
            captain_by_team[team_id] = (p, m)
        if is_vice:
            vice_by_team[team_id] = (p, m)

    final_points: dict[uuid.UUID, Decimal] = {}
    for team_id in team_ids:
        base = points_by_team.get(team_id, Decimal("0"))

        captain = captain_by_team.get(team_id)
        vice = vice_by_team.get(team_id)

        captain_points = captain[0] if captain else None
        captain_minutes = captain[1] if captain else None
        vice_points = vice[0] if vice else None
        vice_minutes = vice[1] if vice else None

        final_points[team_id] = _compute_team_points_vice_if_captain_dnp(
            base_points=base,
            captain_points=captain_points,
            captain_minutes=captain_minutes,
            vice_points=vice_points,
            vice_minutes=vice_minutes,
        )

    # Upsert points
    values = [
        {
            "id": uuid.uuid4(),
            "fantasy_team_id": team_id,
            "transfer_window_id": transfer_window_id,
            "points": points,
            "rank_in_league": None,
        }
        for team_id, points in final_points.items()
    ]

    stmt = insert(TeamWeeklyScore).values(values)
    stmt = stmt.on_conflict_do_update(
        index_elements=[TeamWeeklyScore.fantasy_team_id, TeamWeeklyScore.transfer_window_id],
        set_={
            "points": stmt.excluded.points,
        },
    )
    db.execute(stmt)

    # Recompute ranks (RANK semantics)
    scored = (
        db.query(TeamWeeklyScore.fantasy_team_id, TeamWeeklyScore.points)
        .join(FantasyTeam, FantasyTeam.id == TeamWeeklyScore.fantasy_team_id)
        .filter(FantasyTeam.league_id == league_id)
        .filter(TeamWeeklyScore.transfer_window_id == transfer_window_id)
        .order_by(TeamWeeklyScore.points.desc(), TeamWeeklyScore.fantasy_team_id.asc())
        .all()
    )

    rank_map: dict[uuid.UUID, int] = {}
    last_points: Decimal | None = None
    last_rank = 0

    for idx, (team_id, points) in enumerate(scored, start=1):
        pts = _decimal(points)
        if last_points is None or pts != last_points:
            last_rank = idx
            last_points = pts
        rank_map[team_id] = last_rank

    if rank_map:
        rank_case = case(rank_map, value=TeamWeeklyScore.fantasy_team_id)
        db.execute(
            update(TeamWeeklyScore)
            .where(TeamWeeklyScore.transfer_window_id == transfer_window_id)
            .where(TeamWeeklyScore.fantasy_team_id.in_(list(rank_map.keys())))
            .values(rank_in_league=rank_case)
        )


def score_transfer_window_for_league(
    db: Session,
    *,
    league_id: uuid.UUID,
    transfer_window_id: uuid.UUID,
) -> dict[str, int]:
    """Full scoring pipeline for one league + transfer window."""

    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise ValueError(f"League {league_id} not found")

    sport_ids = [
        sport_id
        for (sport_id,) in (
            db.query(LeagueSport.sport_id)
            .filter(LeagueSport.league_id == league_id)
            .all()
        )
    ]

    if not sport_ids:
        upsert_team_weekly_scores_and_ranks(
            db, league_id=league_id, transfer_window_id=transfer_window_id
        )
        return {"football_players_updated": 0, "cricket_players_updated": 0}

    sports = (
        db.query(Sport.id, Sport.name)
        .filter(Sport.id.in_(sport_ids))
        .all()
    )

    updated_football = 0
    updated_cricket = 0
    updated_basketball = 0

    for sport_id, sport_name in sports:
        slug = (sport_name or "").strip().lower()
        if slug == "football":
            updated_football += score_football_players_for_window(
                db,
                league_id=league_id,
                sport_id=sport_id,
                transfer_window_id=transfer_window_id,
            )
        elif slug == "cricket":
            updated_cricket += score_cricket_players_for_window(
                db,
                league_id=league_id,
                sport_id=sport_id,
                transfer_window_id=transfer_window_id,
            )
        elif slug == "basketball":
            updated_basketball += score_nba_players_for_window(
                db,
                league_id=league_id,
                sport_id=sport_id,
                transfer_window_id=transfer_window_id,
            )

    upsert_team_weekly_scores_and_ranks(
        db, league_id=league_id, transfer_window_id=transfer_window_id
    )

    return {
        "football_players_updated": updated_football,
        "cricket_players_updated": updated_cricket,
        "basketball_players_updated": updated_basketball,
    }


def score_transfer_window_for_season_leagues(
    db: Session,
    *,
    transfer_window_id: uuid.UUID,
    commit: bool = True,
) -> dict[str, int]:
    """Score the transfer window for all leagues in the same season.

    This matches the task signature `score.transfer_window(transfer_window_id)`.
    """

    try:
        window = (
            db.query(TransferWindow)
            .filter(TransferWindow.id == transfer_window_id)
            .first()
        )
        if not window:
            raise ValueError(f"TransferWindow {transfer_window_id} not found")

        league_ids = [
            lid
            for (lid,) in (
                db.query(League.id)
                .filter(League.season_id == window.season_id)
                .all()
            )
        ]

        total_fb = 0
        total_cr = 0
        total_bb = 0
        for league_id in league_ids:
            res = score_transfer_window_for_league(
                db, league_id=league_id, transfer_window_id=transfer_window_id
            )
            total_fb += res.get("football_players_updated", 0)
            total_cr += res.get("cricket_players_updated", 0)
            total_bb += res.get("basketball_players_updated", 0)

        result = {
            "leagues_scored": len(league_ids),
            "football_players_updated": total_fb,
            "cricket_players_updated": total_cr,
            "basketball_players_updated": total_bb,
        }
        if commit:
            db.commit()
        return result
    except Exception:
        if commit:
            db.rollback()
        raise


def score_active_transfer_windows(db: Session, *, commit: bool = True) -> dict[str, int]:
    """Score any currently-active transfer windows (best-effort periodic job)."""

    try:
        now = datetime.now(timezone.utc)
        active_windows = (
            db.query(TransferWindow.id)
            .filter(TransferWindow.start_at <= now)
            .filter(TransferWindow.end_at >= now)
            .all()
        )

        windows = [wid for (wid,) in active_windows]
        leagues_scored = 0
        fb = 0
        cr = 0
        bb = 0

        for wid in windows:
            res = score_transfer_window_for_season_leagues(db, transfer_window_id=wid, commit=False)
            leagues_scored += res.get("leagues_scored", 0)
            fb += res.get("football_players_updated", 0)
            cr += res.get("cricket_players_updated", 0)
            bb += res.get("basketball_players_updated", 0)

        result = {
            "windows_scored": len(windows),
            "leagues_scored": leagues_scored,
            "football_players_updated": fb,
            "cricket_players_updated": cr,
            "basketball_players_updated": bb,
        }
        if commit:
            db.commit()
        return result
    except Exception:
        if commit:
            db.rollback()
        raise

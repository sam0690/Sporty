from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import Numeric, cast, func, update
from sqlalchemy.orm import Session

from app.player.models import CricketStat, FootballStat, Player, PlayerGameweekStat
from app.player.models_nba import NBAStat
from app.services.scoring.rules import resolve_effective_rules, to_decimal


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


def compute_nba_fantasy_points(
    *,
    points: int | None,
    assists: int | None,
    rebounds: int | None,
    steals: int | None,
    blocks: int | None,
    nba_points_10: Decimal,
    nba_assists_10: Decimal,
    nba_rebound: Decimal,
    nba_steal: Decimal,
    nba_block: Decimal,
) -> Decimal:
    # Algorithm: (points/10)*nba_points_10 + (assists/10)*nba_assists_10 + rebounds*nba_rebound + steals*nba_steal + blocks*nba_block.
    points_d = to_decimal(points)
    assists_d = to_decimal(assists)
    rebounds_d = to_decimal(rebounds)
    steals_d = to_decimal(steals)
    blocks_d = to_decimal(blocks)
    return (
        ((points_d / Decimal("10")) * nba_points_10)
        + ((assists_d / Decimal("10")) * nba_assists_10)
        + (rebounds_d * nba_rebound)
        + (steals_d * nba_steal)
        + (blocks_d * nba_block)
    )


def score_football_players_for_window(
    db: Session,
    *,
    league_id: uuid.UUID,
    sport_id: uuid.UUID,
    transfer_window_id: uuid.UUID,
) -> int:
    # Algorithm: update player_gameweek_stats fantasy_points using football child stats and effective rules for goal/assist/cards.
    rules = resolve_effective_rules(
        db,
        league_id=league_id,
        sport_id=sport_id,
        actions=FOOTBALL_ACTIONS.keys(),
        fallback_points=FOOTBALL_ACTIONS,
    )

    pgs = PlayerGameweekStat.__table__
    stats = FootballStat.__table__
    players = Player.__table__

    stmt = (
        update(pgs)
        .where(pgs.c.id == stats.c.base_stat_id)
        .where(pgs.c.transfer_window_id == transfer_window_id)
        .where(pgs.c.player_id == players.c.id)
        .where(players.c.sport_id == sport_id)
        .values(
            fantasy_points=(
                (func.coalesce(stats.c.goals, 0) * rules.points_by_action["football_goal"])
                + (func.coalesce(stats.c.assists, 0) * rules.points_by_action["football_assist"])
                + (func.coalesce(stats.c.yellow_cards, 0) * rules.points_by_action["football_yellow_card"])
                + (func.coalesce(stats.c.red_cards, 0) * rules.points_by_action["football_red_card"])
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
    # Algorithm: update player_gameweek_stats fantasy_points using cricket child stats with coalesce and effective run/wicket/catch/run_out/maiden rules.
    rules = resolve_effective_rules(
        db,
        league_id=league_id,
        sport_id=sport_id,
        actions=CRICKET_ACTIONS,
    )

    pgs = PlayerGameweekStat.__table__
    stats = CricketStat.__table__
    players = Player.__table__

    stmt = (
        update(pgs)
        .where(pgs.c.id == stats.c.base_stat_id)
        .where(pgs.c.transfer_window_id == transfer_window_id)
        .where(pgs.c.player_id == players.c.id)
        .where(players.c.sport_id == sport_id)
        .values(
            fantasy_points=(
                (func.coalesce(stats.c.runs_scored, 0) * rules.points_by_action["cricket_run"])
                + (func.coalesce(stats.c.wickets_taken, 0) * rules.points_by_action["cricket_wicket"])
                + (func.coalesce(stats.c.catches, 0) * rules.points_by_action["cricket_catch"])
                + (func.coalesce(stats.c.run_outs, 0) * rules.points_by_action["cricket_run_out"])
                + (func.coalesce(stats.c.maidens, 0) * rules.points_by_action["cricket_maiden"])
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
    # Algorithm: update player_gameweek_stats fantasy_points using NBA fractional per-10 rules for points/assists and per-unit for rebounds/steals/blocks.
    rules = resolve_effective_rules(
        db,
        league_id=league_id,
        sport_id=sport_id,
        actions=NBA_ACTIONS,
    )

    pgs = PlayerGameweekStat.__table__
    stats = NBAStat.__table__
    players = Player.__table__

    points_num = cast(func.coalesce(stats.c.points, 0), Numeric)
    assists_num = cast(func.coalesce(stats.c.assists, 0), Numeric)

    stmt = (
        update(pgs)
        .where(pgs.c.id == stats.c.base_stat_id)
        .where(pgs.c.transfer_window_id == transfer_window_id)
        .where(pgs.c.player_id == players.c.id)
        .where(players.c.sport_id == sport_id)
        .values(
            fantasy_points=(
                ((points_num / 10) * rules.points_by_action["nba_points_10"])
                + ((assists_num / 10) * rules.points_by_action["nba_assists_10"])
                + (func.coalesce(stats.c.rebounds, 0) * rules.points_by_action["nba_rebound"])
                + (func.coalesce(stats.c.steals, 0) * rules.points_by_action["nba_steal"])
                + (func.coalesce(stats.c.blocks, 0) * rules.points_by_action["nba_block"])
            )
        )
        .execution_options(synchronize_session=False)
    )
    result = db.execute(stmt)
    return int(result.rowcount or 0)

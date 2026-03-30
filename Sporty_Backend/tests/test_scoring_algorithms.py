from __future__ import annotations

import uuid
from decimal import Decimal

from app.services.scoring.player_scoring import compute_nba_fantasy_points
from app.services.scoring.ranking import compute_rank_map
from app.services.scoring.team_scoring import apply_captain_vice_bonus


def test_captain_vice_logic_captain_plays() -> None:
    total = apply_captain_vice_bonus(
        base_points=Decimal("45"),
        captain_points=Decimal("8"),
        captain_minutes=75,
        vice_points=Decimal("6"),
        vice_minutes=90,
    )
    assert total == Decimal("53")


def test_captain_vice_logic_vice_substitutes_when_captain_dnp() -> None:
    total = apply_captain_vice_bonus(
        base_points=Decimal("45"),
        captain_points=Decimal("8"),
        captain_minutes=0,
        vice_points=Decimal("6"),
        vice_minutes=90,
    )
    assert total == Decimal("51")


def test_tie_ranking_uses_sql_rank_semantics() -> None:
    team_a = uuid.uuid4()
    team_b = uuid.uuid4()
    team_c = uuid.uuid4()

    rank_map = compute_rank_map(
        [
            (team_a, Decimal("100")),
            (team_b, Decimal("90")),
            (team_c, Decimal("90")),
        ]
    )

    assert rank_map[team_a] == 1
    assert rank_map[team_b] == 2
    assert rank_map[team_c] == 2


def test_basketball_fractional_scoring_points_example() -> None:
    fantasy_points = compute_nba_fantasy_points(
        points=29,
        assists=0,
        rebounds=0,
        steals=0,
        blocks=0,
        nba_points_10=Decimal("3"),
        nba_assists_10=Decimal("2"),
        nba_rebound=Decimal("1"),
        nba_steal=Decimal("2"),
        nba_block=Decimal("2"),
    )
    assert fantasy_points == Decimal("8.7")

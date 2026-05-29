from decimal import Decimal
import uuid

import pytest
from fastapi import HTTPException

from app.league.auto_pick_service import PoolPlayer, autoPickSquad, validate_squad


def make_player(name: str, sport_type: str, position: str, cost: str, value: str, club: str) -> PoolPlayer:
    return PoolPlayer(
        id=uuid.uuid4(),
        name=name,
        sport_type=sport_type,
        position=position,
        cost=Decimal(cost),
        real_team=club,
        real_team_id=club,
        value=Decimal(value),
        is_available=True,
    )


def test_auto_pick_squad_respects_locked_players_and_budget() -> None:
    gk = make_player("Keeper", "football", "GK", "5", "10", "ClubA")
    defender = make_player("Defender", "football", "DEF", "6", "9", "ClubB")
    pg = make_player("Guard", "basketball", "PG", "7", "8", "ClubC")
    sg = make_player("Shooter", "basketball", "SG", "8", "7", "ClubD")

    sport_config = {
        "sportType": "mixed",
        "totalBudget": Decimal("30"),
        "sports": [
            {"type": "football", "quota": 2, "positions": ["GK", "DEF"], "maxPerClub": 3},
            {"type": "basketball", "quota": 2, "positions": ["PG", "SG"], "maxPerClub": 3},
        ],
    }

    selected, total_cost, budget_remaining = autoPickSquad(
        [gk, defender, pg, sg],
        sport_config,
        lockedPlayerIds=[gk.id],
    )

    assert {player.id for player in selected} == {gk.id, defender.id, pg.id, sg.id}
    assert selected[0].id == gk.id
    assert total_cost == Decimal("26")
    assert budget_remaining == Decimal("4")


def test_validate_squad_rejects_missing_required_positions() -> None:
    gk = make_player("Keeper", "football", "GK", "5", "10", "ClubA")
    def_missing = make_player("Backup", "football", "MID", "5", "9", "ClubB")

    sport_config = {
        "sportType": "football",
        "totalBudget": Decimal("20"),
        "sports": [
            {"type": "football", "quota": 2, "positions": ["GK", "DEF"], "maxPerClub": 3},
        ],
    }

    with pytest.raises(HTTPException) as exc_info:
        validate_squad([gk, def_missing], sport_config)

    assert exc_info.value.status_code == 422
    assert "missing required positions" in str(exc_info.value.detail)
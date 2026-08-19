"""Server-side formation rules for the starting XI.

validate_position_slots was the only position check on the lineup path, and
it is driven by LineupSlot rows that only an admin endpoint creates — so
every normally-created league had none and it returned without checking
anything. A direct API call could save 11 forwards and no goalkeeper.
validate_lineup_for_league_type now enforces the registry's formation bounds
itself; LineupSlot still layers on top where rows exist.
"""
from types import SimpleNamespace

import pytest

from app.core.errors import DomainError
from app.squad.services import validate_lineup_for_league_type

FOOTBALL = SimpleNamespace(id="sport-football", name="football")
BASKETBALL = SimpleNamespace(id="sport-basketball", name="basketball")
LEAGUE = SimpleNamespace(squad_size=15)
BASKETBALL_LEAGUE = SimpleNamespace(squad_size=13)


def player(position: str, sport=FOOTBALL) -> SimpleNamespace:
    return SimpleNamespace(
        id=f"{position}-{id(object())}",
        name=f"{position} player",
        position=position,
        sport_id=sport.id,
    )


def xi(gkp: int, dfd: int, mid: int, fwd: int) -> list[SimpleNamespace]:
    shape = ["GKP"] * gkp + ["DEF"] * dfd + ["MID"] * mid + ["FWD"] * fwd
    return [player(pos) for pos in shape]


@pytest.mark.parametrize(
    "formation",
    [(1, 4, 4, 2), (1, 3, 5, 2), (1, 5, 2, 3), (1, 5, 4, 1), (1, 4, 5, 1)],
)
def test_legal_formations_pass(formation) -> None:
    validate_lineup_for_league_type(xi(*formation), LEAGUE, [FOOTBALL])


def test_no_goalkeeper_rejected() -> None:
    # The bypass this whole check exists for.
    with pytest.raises(DomainError, match="GKP"):
        validate_lineup_for_league_type(xi(0, 5, 3, 3), LEAGUE, [FOOTBALL])


def test_two_goalkeepers_rejected() -> None:
    with pytest.raises(DomainError, match="exactly 1 GKP"):
        validate_lineup_for_league_type(xi(2, 4, 3, 2), LEAGUE, [FOOTBALL])


def test_all_forwards_rejected() -> None:
    lineup = [player("FWD") for _ in range(11)]
    with pytest.raises(DomainError):
        validate_lineup_for_league_type(lineup, LEAGUE, [FOOTBALL])


def test_too_many_defenders_rejected() -> None:
    with pytest.raises(DomainError, match="between 3 and 5 DEF"):
        validate_lineup_for_league_type(xi(1, 6, 3, 1), LEAGUE, [FOOTBALL])


def test_too_few_defenders_rejected() -> None:
    with pytest.raises(DomainError, match="DEF"):
        validate_lineup_for_league_type(xi(1, 2, 5, 3), LEAGUE, [FOOTBALL])


def test_position_codes_normalised_in_lineup() -> None:
    lineup = [player("gk")] + [player("def")] * 4 + [player("mid")] * 4 + [player("fwd")] * 2
    validate_lineup_for_league_type(lineup, LEAGUE, [FOOTBALL])


def test_basketball_has_no_formation_constraint() -> None:
    # Basketball carries a permanent "UNK" tail, so no bounds entry exists.
    lineup = [player("PG", BASKETBALL) for _ in range(5)]
    validate_lineup_for_league_type(lineup, BASKETBALL_LEAGUE, [BASKETBALL])

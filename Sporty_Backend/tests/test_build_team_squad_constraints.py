"""The squad rules budget-mode team building must enforce.

build_initial_team used to check only size/duplicates/budget: the frontend
showed a GKP/DEF/MID/FWD checklist while the API happily accepted 15 forwards
from one club. It now runs check_full_squad_constraints — the same gate every
other roster path (draft picks, transfers, trades, waivers) already used.
"""
from types import SimpleNamespace

from app.squad.services import check_full_squad_constraints


def player(position: str, club: str) -> SimpleNamespace:
    # Duck-typed stand-in for Player, exactly what build_initial_team passes.
    return SimpleNamespace(
        id=f"{position}-{club}-{id(object())}",
        name=f"{position} {club}",
        position=position,
        real_team=club,
        real_team_id=club,
    )


def legal_football_squad() -> list[SimpleNamespace]:
    """2 GKP / 5 DEF / 5 MID / 3 FWD across 5 clubs — max 3 per club."""
    shape = ["GKP"] * 2 + ["DEF"] * 5 + ["MID"] * 5 + ["FWD"] * 3
    return [player(pos, f"Club{i // 3}") for i, pos in enumerate(shape)]


LEAGUE = SimpleNamespace(squad_size=15)


def test_legal_squad_passes() -> None:
    assert (
        check_full_squad_constraints(
            legal_football_squad(), LEAGUE, "football", "single"
        )
        is None
    )


def test_position_minimums_enforced() -> None:
    squad = [player("FWD", f"Club{i // 3}") for i in range(15)]
    violation = check_full_squad_constraints(squad, LEAGUE, "football", "single")
    assert violation is not None and "GKP" in violation


def test_max_per_club_enforced() -> None:
    squad = legal_football_squad()
    squad[3] = player("DEF", "Club0")  # moves a Club1 DEF to Club0 → 4 there
    violation = check_full_squad_constraints(squad, LEAGUE, "football", "single")
    assert violation is not None and "max is 3" in violation


def test_incomplete_squad_skips_position_minimums() -> None:
    # Size is validate_squad_size's job; minimums only bite once complete.
    assert (
        check_full_squad_constraints(
            [player("FWD", "Club0")], LEAGUE, "football", "single"
        )
        is None
    )


def test_extra_defender_rejected() -> None:
    # 6 DEF / 4 MID still sums to 15 and satisfies every minimum except MID,
    # so minimums-only validation let this through as long as the displaced
    # position stayed above its own floor.
    shape = ["GKP"] * 2 + ["DEF"] * 6 + ["MID"] * 4 + ["FWD"] * 3
    squad = [player(pos, f"Club{i // 3}") for i, pos in enumerate(shape)]
    violation = check_full_squad_constraints(squad, LEAGUE, "football", "single")
    assert violation is not None
    assert "exactly 5 DEF" in violation and "you have 6" in violation


def test_extra_keeper_rejected() -> None:
    shape = ["GKP"] * 3 + ["DEF"] * 5 + ["MID"] * 4 + ["FWD"] * 3
    squad = [player(pos, f"Club{i // 3}") for i, pos in enumerate(shape)]
    violation = check_full_squad_constraints(squad, LEAGUE, "football", "single")
    assert violation is not None and "exactly 2 GKP" in violation


def test_one_keeper_short_rejected() -> None:
    shape = ["GKP"] * 1 + ["DEF"] * 5 + ["MID"] * 6 + ["FWD"] * 3
    squad = [player(pos, f"Club{i // 3}") for i, pos in enumerate(shape)]
    violation = check_full_squad_constraints(squad, LEAGUE, "football", "single")
    assert violation is not None and "GKP" in violation


def test_position_codes_are_normalised() -> None:
    """Position is a free-text column: "gkp", " GKP " and the legacy "GK"
    written by scripts/link_epl_players.py must all count as GKP."""
    shape = ["gkp", " GKP "] + ["DEF"] * 5 + ["MID"] * 5 + ["FWD"] * 3
    squad = [player(pos, f"Club{i // 3}") for i, pos in enumerate(shape)]
    assert check_full_squad_constraints(squad, LEAGUE, "football", "single") is None

    legacy = legal_football_squad()
    legacy[0] = player("GK", legacy[0].real_team)
    assert check_full_squad_constraints(legacy, LEAGUE, "football", "single") is None

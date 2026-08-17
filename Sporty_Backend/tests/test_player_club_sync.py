"""Reconciliation rules for scripts/sync_player_clubs.py.

`reconcile` is pure, so these run with no database and no network.
"""
import sys
import uuid
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.sync_player_clubs import (
    Decision,
    SquadEntry,
    fold,
    reconcile,
    select_missing,
)

ARSENAL = uuid.uuid4()
CHELSEA = uuid.uuid4()
REAL_MADRID = uuid.uuid4()
ATLETICO = uuid.uuid4()


def player(name, external_api_id, club_name, club_id, is_available=True):
    return SimpleNamespace(
        id=uuid.uuid4(),
        name=name,
        external_api_id=external_api_id,
        real_team=club_name,
        real_team_id=club_id,
        is_available=is_available,
    )


def only(decisions: list[Decision]) -> Decision:
    assert len(decisions) == 1, decisions
    return decisions[0]


def test_in_league_move_is_a_transfer():
    p = player("B. Saka", "1460", "Arsenal", ARSENAL)
    decisions = reconcile(
        [p],
        {"1460": SquadEntry("Chelsea", CHELSEA, "EPL")},
        {ARSENAL: 25, CHELSEA: 25},
        {},
    )
    d = only(decisions)
    assert (d.action, d.old_club, d.new_club, d.new_club_id) == (
        "transfer", "Arsenal", "Chelsea", CHELSEA,
    )


def test_cross_league_move_is_a_transfer_not_a_departure():
    """EPL -> La Liga. The old per-competition script deactivated these."""
    p = player("Trent", "2020", "Arsenal", ARSENAL)
    d = only(reconcile(
        [p],
        {"2020": SquadEntry("Real Madrid", REAL_MADRID, "LALIGA")},
        {ARSENAL: 25, REAL_MADRID: 24},
        {},
    ))
    assert d.action == "transfer"
    assert d.new_club == "Real Madrid"


def test_absent_from_every_squad_is_only_flagged_by_default():
    """The feed omits current players — a 2026-08-16 dry run proposed
    deactivating Lewandowski, ter Stegen and Griezmann. See
    ABSENCE_IS_WEAK_EVIDENCE."""
    p = player("R. Lewandowski", "521", "Barcelona", ARSENAL)
    d = only(reconcile([p], {}, {ARSENAL: 25}, {}))
    assert d.action == "flag"
    assert "confirm before deactivating" in d.note


def test_absent_is_deactivated_only_when_opted_in():
    p = player("C. Ronaldo", "874", "Arsenal", ARSENAL)
    d = only(reconcile([p], {}, {ARSENAL: 25}, {}, deactivate_missing=True))
    assert d.action == "deactivate"
    assert "none of the supported leagues" in d.note


def test_thin_squad_is_flagged_even_when_deactivation_is_opted_in():
    """Atlético returned 5 players on 2026-08-15 — a provider gap, not 25 exits."""
    p = player("A. Griezmann", "759", "Atletico Madrid", ATLETICO)
    d = only(reconcile([p], {}, {ATLETICO: 5}, {}, deactivate_missing=True))
    assert d.action == "flag"
    assert "provider gap" in d.note


def test_slug_id_player_is_flagged_never_touched():
    p = player("M. Cucurella", "football:marc_cucurella:chelsea:def", "Chelsea", CHELSEA)
    d = only(reconcile([p], {}, {CHELSEA: 25}, {}))
    assert d.action == "flag"
    assert "no numeric API-Football id" in d.note


def test_name_collision_at_target_club_is_flagged():
    """uq_players_identity violations abort the whole transaction."""
    incumbent_id = uuid.uuid4()
    p = player("Álvaro Fernández", "3001", "Arsenal", ARSENAL)
    d = only(reconcile(
        [p],
        {"3001": SquadEntry("Real Madrid", REAL_MADRID, "LALIGA")},
        {ARSENAL: 25, REAL_MADRID: 24},
        {(fold("Álvaro Fernández"), REAL_MADRID): incumbent_id},
    ))
    assert d.action == "flag"
    assert "already has a player of that name" in d.note


def test_same_club_is_a_no_op():
    p = player("B. Saka", "1460", "Arsenal", ARSENAL)
    assert reconcile(
        [p], {"1460": SquadEntry("Arsenal", ARSENAL, "EPL")}, {ARSENAL: 25}, {}
    ) == []


def test_returning_player_is_reactivated():
    p = player("B. Saka", "1460", "Arsenal", ARSENAL, is_available=False)
    d = only(reconcile(
        [p], {"1460": SquadEntry("Arsenal", ARSENAL, "EPL")}, {ARSENAL: 25}, {}
    ))
    assert d.action == "reactivate"


def test_already_unavailable_and_still_absent_is_a_no_op():
    """Don't re-log the same departure on every run."""
    p = player("C. Ronaldo", "874", "Arsenal", ARSENAL, is_available=False)
    assert reconcile([p], {}, {ARSENAL: 25}, {}) == []


def test_fold_matches_the_unique_index_expression():
    assert fold("  Álvaro   Fernández ") == "álvaro fernández"


def test_two_same_named_players_moving_to_one_club_only_lets_the_first_through():
    a = player("Dani Rodriguez", "4001", "Arsenal", ARSENAL)
    b = player("Dani Rodriguez", "4002", "Chelsea", CHELSEA)
    decisions = reconcile(
        [a, b],
        {
            "4001": SquadEntry("Real Madrid", REAL_MADRID, "LALIGA"),
            "4002": SquadEntry("Real Madrid", REAL_MADRID, "LALIGA"),
        },
        {ARSENAL: 25, CHELSEA: 25, REAL_MADRID: 24},
        {},
    )
    assert [d.action for d in decisions] == ["transfer", "flag"]


# ── select_missing (the --create-missing candidate set) ──────────────────────


def squad(name, club_id, club_name="Arsenal", position="MID"):
    return SquadEntry(club_name, club_id, "EPL", name=name, position=position)


def test_select_missing_picks_only_ids_we_do_not_hold():
    squad_map = {"1": squad("Bukayo Saka", ARSENAL), "2": squad("New Kid", ARSENAL)}
    missing = select_missing(squad_map, known_ids={"1"}, taken_names={})
    assert [external for external, _ in missing] == ["2"]


def test_select_missing_skips_id_drift():
    """Same player, different provider id — creating would duplicate them."""
    squad_map = {"99": squad("Bukayo Saka", ARSENAL)}
    taken = {(fold("Bukayo  SAKA"), ARSENAL): uuid.uuid4()}
    assert select_missing(squad_map, known_ids=set(), taken_names=taken) == []


def test_select_missing_allows_same_name_at_a_different_club():
    squad_map = {"99": squad("Danny Ward", CHELSEA, club_name="Chelsea")}
    taken = {(fold("Danny Ward"), ARSENAL): uuid.uuid4()}
    missing = select_missing(squad_map, known_ids=set(), taken_names=taken)
    assert [external for external, _ in missing] == ["99"]


def test_select_missing_skips_nameless_entries():
    assert select_missing({"5": squad("", ARSENAL)}, known_ids=set(), taken_names={}) == []

"""Tests for app/services/sync/name_matching.py.

Every case below is a real mismatch caught while dry-running the FPL re-seed
against production data.
"""
from __future__ import annotations

from app.services.sync.name_matching import Candidate, NameIndex, normalize, surname


def _fpl(first: str, second: str, web: str, club: str = "Aston Villa", code: int = 0):
    return Candidate.build(given=first, family=second, short=web, club=club, payload=code)


def test_normalize_unfolds_entities_accents_and_punctuation() -> None:
    assert normalize("J. O&apos;Brien") == "j o brien"
    assert normalize("Benjamin Šeško") == "benjamin sesko"
    assert normalize("Brighton &amp; Hove Albion") == "brighton hove albion"
    # Punctuation becomes a separator so hyphenated and spaced spellings agree.
    assert normalize("Hudson-Odoi") == normalize("Hudson Odoi")
    assert normalize("Calvert-Lewin") == "calvert lewin"


def test_surname_takes_the_last_word() -> None:
    assert surname("Callum Hudson-Odoi") == "odoi"
    assert surname("") == ""


def test_unique_family_name_still_requires_the_given_name_to_agree() -> None:
    """The pool holds four players surnamed Gomes; the feed lists one.

    Matching on family name alone collapsed all four onto that single element
    and "transferred" three of them to Aston Villa.
    """
    index = NameIndex.build([_fpl("Joao", "Gomes", "Joao Gomes", code=1)])

    assert index.match("João Gomes", club="Wolverhampton Wanderers") == 1
    for impostor in ("Rodrigo Gomes", "Angel Gomes", "Toti Gomes"):
        assert index.match(impostor, club="Wolverhampton Wanderers") is None


def test_initial_only_given_names_still_match() -> None:
    """Our names are mixed-format: "E. Balcombe" must reach "Elliot Balcombe"."""
    index = NameIndex.build([_fpl("Elliot", "Balcombe", "Balcombe", code=2)])

    assert index.match("E. Balcombe") == 2
    assert index.match("R. Balcombe") is None


def test_same_family_name_different_people_resolve_by_given_name() -> None:
    index = NameIndex.build(
        [
            _fpl("Jordan", "Henderson", "Henderson", club="Chelsea", code=3),
            _fpl("Dean", "Henderson", "Henderson", club="Crystal Palace", code=4),
        ]
    )

    assert index.match("Jordan Henderson", club="Brentford") == 3
    assert index.match("Dean Henderson", club="Crystal Palace") == 4


def test_hyphenated_feed_name_matches_spaced_pool_name() -> None:
    index = NameIndex.build([_fpl("Callum", "Hudson-Odoi", "Hudson-Odoi", code=7)])

    assert index.match("Callum Hudson Odoi") == 7


def test_single_token_name_requires_short_name_equality() -> None:
    """"Denner" has no given name to corroborate, so demand an exact short name."""
    index = NameIndex.build([_fpl("Denner", "Gomes Silva", "Denner", code=5)])

    assert index.match("Denner") == 5
    # A different single-token player sharing the family key must not match.
    assert index.match("Silva") is None


def test_club_only_breaks_ties_it_never_creates_a_match() -> None:
    """A genuine transfer must still match despite the club disagreeing."""
    index = NameIndex.build([_fpl("Jack", "Grealish", "Grealish", club="Man City", code=8)])

    assert index.match("Jack Grealish", club="Everton") == 8


def test_unknown_family_name_is_not_matched() -> None:
    index = NameIndex.build([_fpl("Erling", "Haaland", "Haaland", code=6)])

    assert index.match("Mohamed Salah") is None


def test_from_full_name_handles_single_field_feeds() -> None:
    """football-data.org exposes one undifferentiated name field."""
    index = NameIndex.build(
        [Candidate.from_full_name("Unai Simón", club="Athletic Club", payload=9)]
    )

    assert index.match("Unai Simón", club="Athletic Club") == 9
    assert index.match("U. Simón") == 9
    assert index.match("Aymeric Simón") is None

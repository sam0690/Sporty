from __future__ import annotations

import uuid
from decimal import Decimal

from app.services.scoring.auto_subs import LineupPlayer, resolve_effective_lineup
from app.services.scoring.team_scoring import LineupRow, resolve_team_gameweek


def P(pid, pos, minutes, points, bench_order=None):
    return LineupPlayer(
        player_id=pid,
        position_key=pos,
        minutes_played=minutes,
        points=Decimal(str(points)),
        bench_order=bench_order,
    )


# A standard 4-4-2 football XI worth of position bounds (single sport).
FOOTBALL_BOUNDS = {
    "GKP": (1, 1),
    "DEF": (3, 5),
    "MID": (2, 5),
    "FWD": (1, 3),
}


def test_no_subs_when_everyone_plays() -> None:
    starters = [
        P("g", "GKP", 90, 6),
        P("d1", "DEF", 90, 5),
        P("d2", "DEF", 90, 4),
        P("d3", "DEF", 90, 3),
        P("m1", "MID", 90, 7),
        P("f1", "FWD", 90, 8),
    ]
    bench = [P("bg", "GKP", 90, 2, bench_order=0)]
    res = resolve_effective_lineup(starters, bench, {})
    assert res.effective_ids == {"g", "d1", "d2", "d3", "m1", "f1"}
    assert res.base_points == Decimal("33")
    assert res.subbed_in == {}


def test_non_playing_starter_replaced_in_bench_order() -> None:
    starters = [P("m1", "MID", 0, 0), P("m2", "MID", 90, 5)]
    bench = [
        P("b1", "MID", 0, 0, bench_order=0),   # didn't play -> ineligible
        P("b2", "MID", 90, 4, bench_order=1),  # should come on
    ]
    res = resolve_effective_lineup(starters, bench, {})
    assert res.subbed_out == {"m1": "b2"}
    assert res.subbed_in == {"b2": "m1"}
    assert res.effective_ids == {"m2", "b2"}
    assert res.base_points == Decimal("9")


def test_goalkeeper_only_replaced_by_goalkeeper() -> None:
    # GK didn't play. First bench player is an outfielder (higher priority) but
    # swapping them in would break GKP min -> must skip to the bench GK.
    starters = [
        P("g", "GKP", 0, 0),
        P("d1", "DEF", 90, 3),
        P("d2", "DEF", 90, 3),
        P("d3", "DEF", 90, 3),
        P("m1", "MID", 90, 4),
        P("f1", "FWD", 90, 5),
    ]
    bench = [
        P("bd", "DEF", 90, 2, bench_order=0),  # outfielder, higher priority
        P("bg", "GKP", 90, 1, bench_order=1),  # keeper, lower priority
    ]
    # Only the GKP slot is constrained here; removing the keeper drops GKP to 0
    # (< min 1), so an outfielder can't fill in — only the bench keeper can.
    res = resolve_effective_lineup(starters, bench, {"GKP": (1, 1)})
    assert res.subbed_out == {"g": "bg"}
    assert "bd" not in res.effective_ids
    assert res.effective_ids == {"bg", "d1", "d2", "d3", "m1", "f1"}


def test_no_sub_when_formation_cannot_be_kept_valid() -> None:
    # A defender didn't play; only bench player is a forward. Subbing them in
    # would drop DEF below its min of 3 -> no legal sub, defender stays at 0.
    starters = [
        P("g", "GKP", 90, 5),
        P("d1", "DEF", 0, 0),
        P("d2", "DEF", 90, 3),
        P("d3", "DEF", 90, 3),
        P("m1", "MID", 90, 4),
        P("f1", "FWD", 90, 5),
    ]
    bench = [P("bf", "FWD", 90, 6, bench_order=0)]
    res = resolve_effective_lineup(starters, bench, {"DEF": (3, 5)})
    assert res.subbed_in == {}
    assert res.effective_ids == {"g", "d1", "d2", "d3", "m1", "f1"}
    assert res.base_points == Decimal("20")


def test_bench_player_used_once_across_multiple_gaps() -> None:
    starters = [P("m1", "MID", 0, 0), P("m2", "MID", 0, 0), P("m3", "MID", 90, 5)]
    bench = [P("b1", "MID", 90, 4, bench_order=0)]  # only one eligible sub
    res = resolve_effective_lineup(starters, bench, {})
    # b1 fills the first gap; the second non-player (m2) has no one left, so it
    # stays in the XI scoring 0.
    assert res.subbed_out == {"m1": "b1"}
    assert res.effective_ids == {"m2", "m3", "b1"}
    assert res.base_points == Decimal("9")


# ── resolve_team_gameweek: auto-subs + captain/vice together ──────────────────

def R(pid, pos, minutes, points, *, starter=True, bench_order=None, cap=False, vice=False):
    return LineupRow(
        player_id=pid,
        sport_id=uuid.uuid4() if pos else None,
        position=pos,
        is_starter=starter,
        bench_order=bench_order,
        is_captain=cap,
        is_vice_captain=vice,
        minutes_played=minutes,
        points=Decimal(str(points)),
    )


def test_team_gameweek_vice_takes_over_when_captain_auto_subbed() -> None:
    team = uuid.uuid4()
    cap, vice, s3, b1 = uuid.uuid4(), uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    rows = [
        R(cap, "MID", 0, 5, cap=True),          # captain didn't play
        R(vice, "MID", 90, 6, vice=True),       # vice played
        R(s3, "MID", 90, 4),
        R(b1, "MID", 90, 3, starter=False, bench_order=0),
    ]
    res = resolve_team_gameweek(team, rows, {})

    # base = vice(6) + s3(4) + b1(3) = 13; +vice bonus 6 = 19
    assert res.base_points == Decimal("13")
    assert res.captain_vice_bonus == Decimal("6")
    assert res.total_points == Decimal("19")

    by_id = {p.player_id: p for p in res.players}
    assert by_id[cap].status == "subbed_out" and by_id[cap].counted is False
    assert by_id[b1].status == "subbed_in" and by_id[b1].counted is True
    assert by_id[vice].captain_bonus == Decimal("6")
    assert by_id[cap].captain_bonus == Decimal("0")


def test_team_gameweek_captain_played_doubles() -> None:
    team = uuid.uuid4()
    cap, s2 = uuid.uuid4(), uuid.uuid4()
    rows = [
        R(cap, "MID", 90, 7, cap=True),
        R(s2, "MID", 90, 3, vice=True),
    ]
    res = resolve_team_gameweek(team, rows, {})
    assert res.base_points == Decimal("10")
    assert res.total_points == Decimal("17")  # captain 7 counted twice
    by_id = {p.player_id: p for p in res.players}
    assert by_id[cap].captain_bonus == Decimal("7")

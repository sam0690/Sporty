"""
Squad validation — pure functions with no DB I/O.

Each function accepts already-loaded SQLAlchemy model instances and raises
ValueError with a descriptive message.  Callers (league/services.py) catch
ValueError and re-raise as the appropriate HTTPException so that the HTTP
status code stays with the HTTP layer.

No imports from app.league.services or app.auth — only leaf-level model
modules are imported so the dependency graph stays acyclic:

    league/services.py
        → squad/services.py
            → league/sportConfigs.py   (pure config, no DB)
            → (duck-typed model access — no hard model imports needed)
"""
from __future__ import annotations

import uuid
from typing import Any

from app.core.errors import DomainError
from app.league.sportConfigs import (
    MIXED_SPORT_QUOTAS,
    derive_sport_type,
    get_max_per_club,
    get_position_minimums,
)

# ── Lineup size rules (starters / bench / total) per sport type ───────────────
#
# "mixed" refers to combined football + basketball leagues (15-player squad).
# These values mirror the constants that previously lived in league/services.py.
_LINEUP_SIZE_RULES: dict[str, dict[str, int]] = {
    "football":  {"starting": 11, "bench": 4,  "total": 15},
    "basketball": {"starting": 5,  "bench": 8,  "total": 13},
    "mixed":     {"starting": 9,  "bench": 6,  "total": 15},
}

# Exact per-sport starter requirements inside a mixed starting lineup.
# 5 + 4 = 9, matching _LINEUP_SIZE_RULES["mixed"]["starting"] and the frontend's
# MULTISPORT_STARTER_REQUIREMENTS. (These are the STARTER split, not the squad
# quotas — the squad is 8 football + 7 basketball = 15, of which 5 + 4 start and
# 3 + 3 sit on the bench.)
_MIXED_STARTER_REQUIREMENTS: dict[str, int] = {
    "football":  5,
    "basketball": 4,
}


# ── helpers ───────────────────────────────────────────────────────────────────

def _player_id(obj: Any) -> uuid.UUID:
    """Extract the real-world player UUID from either a Player or TeamPlayer."""
    if hasattr(obj, "player_id"):   # TeamPlayer
        return obj.player_id
    return obj.id                   # Player


def _player_sport_id(obj: Any) -> Any:
    """Extract sport_id whether obj is a Player or TeamPlayer (with loaded .player)."""
    if hasattr(obj, "sport_id") and obj.sport_id is not None:
        return obj.sport_id          # Player
    if hasattr(obj, "player") and obj.player is not None:
        return obj.player.sport_id   # TeamPlayer with loaded relationship
    return None


def _player_position(obj: Any) -> str | None:
    """Extract position from Player or TeamPlayer (with loaded .player)."""
    if hasattr(obj, "position") and obj.position is not None:
        return obj.position          # Player
    if hasattr(obj, "player") and obj.player is not None:
        return getattr(obj.player, "position", None)
    return None


def _player_name(obj: Any) -> str:
    if hasattr(obj, "name"):
        return obj.name
    if hasattr(obj, "player") and obj.player is not None and hasattr(obj.player, "name"):
        return obj.player.name
    return str(getattr(obj, "id", obj))


def _player_real_team_key(obj: Any) -> Any:
    """Club identity for max-per-club counting: real_team_id when present
    (Player.real_team is still migrating to a nullable FK — see project tech
    debt), falling back to the string real_team, then the player's own id so
    two players with no club data never silently count as the same club."""
    player = obj.player if hasattr(obj, "player") and obj.player is not None else obj
    return (
        getattr(player, "real_team_id", None)
        or getattr(player, "real_team", None)
        or _player_id(obj)
    )


# ── Public API ────────────────────────────────────────────────────────────────


def validate_squad_size(
    team_players: list[Any],
    league: Any,
    sports: list[Any] | None = None,
) -> None:
    """Validate the size and composition of an assembled squad.

    team_players: list of Player **or** TeamPlayer objects representing the
        candidate squad.  Pass only *active* (unreleased) entries — i.e.
        TeamPlayer rows where released_window_id is None.
    league: League instance.  Uses league.squad_size as the expected count.
    sports: optional list of Sport objects attached to the league.  When
        supplied and the league is mixed, also validates that the per-sport
        minimum quota is satisfied (e.g. at least 8 football + 7 basketball
        players).  Quotas are read from MIXED_SPORT_QUOTAS in sportConfigs.

    Raises ValueError if:
      - len(team_players) != league.squad_size
      - Duplicate player IDs are detected.
      - (When sports provided) Any per-sport minimum quota is not met.
    """
    count = len(team_players)
    if count != league.squad_size:
        raise DomainError(
            f"Squad must contain exactly {league.squad_size} player(s), got {count}."
        )

    ids = [_player_id(tp) for tp in team_players]
    if len(ids) != len(set(ids)):
        raise DomainError("Duplicate players are not allowed in the squad.")

    if not sports:
        return

    sport_type = derive_sport_type(sports)
    if sport_type != "mixed":
        return

    # Mixed league — verify minimum per-sport quotas are satisfied.
    sport_id_by_name: dict[str, Any] = {
        s.name.strip().lower(): s.id
        for s in sports
        if hasattr(s, "name") and s.name
    }
    counts_by_sport: dict[Any, int] = {}
    for tp in team_players:
        sid = _player_sport_id(tp)
        if sid is not None:
            counts_by_sport[sid] = counts_by_sport.get(sid, 0) + 1

    for sport_name, required in MIXED_SPORT_QUOTAS.items():
        sport_id = sport_id_by_name.get(sport_name)
        if not sport_id:
            raise DomainError(
                f"Mixed league is missing required sport '{sport_name}'."
            )
        actual = counts_by_sport.get(sport_id, 0)
        if actual < required:
            raise DomainError(
                f"Mixed team must include at least {required} {sport_name} "
                f"player(s) in the squad, got {actual}."
            )


def validate_position_slots(
    team_players: list[Any],
    lineup_slots: list[Any],
) -> None:
    """Validate that a set of players satisfies all position-slot constraints.

    team_players: list of Player objects (or TeamPlayer with loaded .player).
        Pass the full squad for squad-building validation, or just the starters
        for starting-lineup validation.
    lineup_slots: list of LineupSlot objects (sport_id, position, min_count,
        max_count).  If empty no position constraints exist and the function
        returns immediately.

    Each player must have a sport_id and position attribute (or .player.sport_id
    / .player.position for TeamPlayer instances).

    Raises ValueError if:
      - Any player is missing sport or position data.
      - Any position count falls outside [min_count, max_count] for a slot.
    """
    if not lineup_slots:
        return

    # Tally (sport_id, normalised_position) across all supplied players.
    counts: dict[tuple[Any, str], int] = {}
    for tp in team_players:
        sport_id = _player_sport_id(tp)
        position = _player_position(tp)
        if not sport_id or not position:
            raise DomainError(
                f"Player '{_player_name(tp)}' is missing required "
                "sport or position data."
            )
        key = (sport_id, position.strip().upper())
        counts[key] = counts.get(key, 0) + 1

    for slot in lineup_slots:
        key = (slot.sport_id, slot.position.strip().upper())
        count = counts.get(key, 0)

        if count < slot.min_count:
            raise DomainError(
                f"Position '{slot.position}' requires at least "
                f"{slot.min_count} player(s), but {count} selected."
            )
        if count > slot.max_count:
            raise DomainError(
                f"Position '{slot.position}' allows at most "
                f"{slot.max_count} player(s), but {count} selected."
            )


def validate_lineup_for_league_type(
    lineup: list[Any],
    league: Any,
    sports: list[Any],
) -> None:
    """Validate that a starting lineup is structurally correct for the league type.

    Uses SPORT_REGISTRY (via derive_sport_type) to detect whether the
    league is single-sport or mixed and select the appropriate rules from
    _LINEUP_SIZE_RULES.

    lineup: list of Player objects (the proposed starting XI / five / nine).
        All entries must already belong to the team — caller's responsibility.
    league: League instance.  league.squad_size is used as the expected total
        squad count to derive the bench size (total − starters).
    sports: list of Sport objects attached to the league.  Drives sport-type
        detection and, for mixed leagues, per-sport starter-count validation.

    Checks performed:
      1. league.squad_size matches the expected total for this sport type.
      2. len(lineup) equals the expected starters count for this sport type.
      3. Bench size (league.squad_size − starters) equals the expected bench.
      4. Mixed leagues only: each sport contributes exactly the required number
         of starters (_MIXED_STARTER_REQUIREMENTS).

    Raises ValueError with a descriptive message for the first violated check.
    Unknown sport types are silently skipped (unknown rules → no constraint).
    """
    sport_type = derive_sport_type(sports)
    rules = _LINEUP_SIZE_RULES.get(sport_type)

    if rules is None:
        # Unrecognised sport combination — no structural rules to enforce.
        return

    sport_label = sport_type.title()
    total_squad = league.squad_size
    starting_count = len(lineup)
    bench_count = total_squad - starting_count

    if total_squad != rules["total"]:
        raise DomainError(
            f"{sport_label} team must have exactly {rules['total']} squad "
            f"player(s), got {total_squad}."
        )

    if starting_count != rules["starting"]:
        raise DomainError(
            f"{sport_label} lineup must have exactly {rules['starting']} "
            f"starting player(s), got {starting_count}."
        )

    if bench_count != rules["bench"]:
        raise DomainError(
            f"{sport_label} lineup must have exactly {rules['bench']} "
            f"bench player(s), got {bench_count}."
        )

    if sport_type != "mixed":
        return

    # ── Mixed league: validate per-sport starter distribution ────────────────
    sport_id_by_name: dict[str, Any] = {
        s.name.strip().lower(): s.id
        for s in sports
        if hasattr(s, "name") and s.name
    }

    starter_counts_by_sport: dict[Any, int] = {}
    for player in lineup:
        sport_id = _player_sport_id(player)
        if not sport_id:
            raise DomainError(
                f"Player '{_player_name(player)}' is missing sport assignment."
            )
        starter_counts_by_sport[sport_id] = starter_counts_by_sport.get(sport_id, 0) + 1

    for sport_name, required in _MIXED_STARTER_REQUIREMENTS.items():
        sport_id = sport_id_by_name.get(sport_name)
        if not sport_id:
            raise DomainError(
                f"Mixed league is missing required sport '{sport_name}'."
            )
        actual = starter_counts_by_sport.get(sport_id, 0)
        if actual != required:
            football_req = _MIXED_STARTER_REQUIREMENTS["football"]
            basketball_req = _MIXED_STARTER_REQUIREMENTS["basketball"]
            raise DomainError(
                f"Mixed starting lineup must include exactly "
                f"{football_req} football and {basketball_req} basketball "
                f"player(s)."
            )


def get_lineup_size_rules(sports: list[Any]) -> dict[str, int] | None:
    """Public read of _LINEUP_SIZE_RULES for the sport-type derived from `sports`.

    Lets callers outside this module (e.g. the lineup carry-forward service,
    which needs to know how many starters to select *before* it can call
    validate_lineup_for_league_type) read the same rule set without reaching
    into the underscore-prefixed module constant directly.
    """
    return _LINEUP_SIZE_RULES.get(derive_sport_type(sports))


def get_mixed_starter_requirements() -> dict[str, int]:
    """Public read of _MIXED_STARTER_REQUIREMENTS (see get_lineup_size_rules)."""
    return dict(_MIXED_STARTER_REQUIREMENTS)


# ── Squad constraint checks (max-per-club, position minimums) ────────────────
#
# Shared by every entry point that adds a player to a roster — draft picks,
# transfers, trades, and free-agent/waiver claims — so max-per-club and
# position-minimum rules are enforced consistently everywhere instead of each
# call site re-implementing (or skipping) the same rule.


def _assert_max_per_club(team_players: list[Any], sport_type: str) -> None:
    """Raise ValueError if any real-world club exceeds the sport's cap across
    the given (already-final/projected) list of players."""
    max_per_club = get_max_per_club(sport_type)
    if not max_per_club:
        return  # sport has no club cap

    counts: dict[Any, int] = {}
    labels: dict[Any, Any] = {}
    for tp in team_players:
        key = _player_real_team_key(tp)
        counts[key] = counts.get(key, 0) + 1
        if key not in labels:
            player = tp.player if hasattr(tp, "player") and tp.player is not None else tp
            labels[key] = getattr(player, "real_team", None) or "this club"

    for key, count in counts.items():
        if count > max_per_club:
            raise DomainError(
                f"Squad would have {count} players from {labels[key]}, "
                f"max is {max_per_club}."
            )


def _assert_position_minimums_if_complete(
    team_players: list[Any],
    league: Any,
    sport_type: str,
    mode: str,
) -> None:
    """Position minimums only become a real constraint once the squad would
    be complete — you can't have hit a minimum with slots/picks still to
    come, mirroring how validate_squad_size only checks size at completion."""
    if len(team_players) < league.squad_size:
        return
    minimums = get_position_minimums(sport_type, mode)
    if not minimums:
        return

    counts: dict[str, int] = {}
    for tp in team_players:
        pos = _player_position(tp)
        if pos:
            counts[pos] = counts.get(pos, 0) + 1

    for pos, required in minimums.items():
        actual = counts.get(pos, 0)
        if actual < required:
            raise DomainError(
                f"Squad needs at least {required} {pos} player(s), has {actual}."
            )


def check_full_squad_constraints(
    team_players: list[Any],
    league: Any,
    sport_type: str,
    mode: str,
) -> str | None:
    """Validate max-per-club and (once complete) position minimums for a
    complete or fully-projected roster in one shot — for entry points that
    can change multiple players at once (e.g. a transfer session confirming
    several staged in/out pairs together), where there's no single
    incoming/outgoing pair to hand to check_squad_constraints.

    team_players: the FINAL roster being validated — Player or TeamPlayer
        objects; caller loads/assembles this (no DB I/O here, per the module
        docstring).

    Returns a violation message, or None if the roster is legal.
    """
    try:
        _assert_max_per_club(team_players, sport_type)
        _assert_position_minimums_if_complete(team_players, league, sport_type, mode)
    except ValueError as exc:
        return str(exc)
    return None


def check_squad_constraints(
    team_players: list[Any],
    league: Any,
    sport_type: str,
    mode: str,
    incoming_player: Any,
    outgoing_player: Any | None = None,
) -> str | None:
    """Validate that adding `incoming_player` to a roster (optionally
    swapping out `outgoing_player`) keeps max-per-club within its cap and,
    once the squad would be complete, satisfies every position minimum.

    team_players: the team's CURRENT active roster (before this change) —
        Player or TeamPlayer objects; caller loads this (no DB I/O here, per
        the module docstring).
    sport_type / mode: from derive_sport_type(...) and "single"/"mixed" —
        selects which SPORT_REGISTRY entry applies.

    Returns a violation message, or None if the change is legal — this
    string-or-None shape (rather than raising) matches the calling
    convention already used by draft_roster_service.check_add_drop, the
    other place this gets called from.
    """
    outgoing_id = _player_id(outgoing_player) if outgoing_player is not None else None
    projected_players = [
        tp for tp in team_players if outgoing_id is None or _player_id(tp) != outgoing_id
    ] + [incoming_player]
    return check_full_squad_constraints(projected_players, league, sport_type, mode)

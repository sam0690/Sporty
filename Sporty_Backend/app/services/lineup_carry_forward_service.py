"""
Lineup carry-forward — fills in a missing gameweek lineup by reusing the
team's previous gameweek's lineup, patched for squad changes since then.

Trigger: called from app/tasks/transfer_tasks.py right after a
TransferWindow's lineup_deadline_at passes and it gets marked lineup_locked
(see app/services/transfer_window_service.py::auto_lock_expired_lineups).
That is the exact moment "gameweek N's lineup-setting window closed" — any
team with zero TeamGameweekLineup rows for that window at that instant would
otherwise score 0 with no lineup on record at all (see team_scoring.py,
upsert_team_weekly_scores — a missing lineup silently resolves to 0 points,
nothing errors).

This module never invents a lineup from scratch and never overrides a
lineup the user actually saved — it only acts when zero rows exist for a
team+window, and it reuses the SAME validation functions update_lineup()
uses before writing anything, so a carried-forward lineup can never violate
a rule a manually-saved one couldn't. If squad changes since gameweek N-1
make a valid lineup impossible (e.g. too many starters transferred out to
still meet position-slot minimums), it skips that team entirely rather than
writing something broken — the team just stays lineup-less, same as today.

Chains naturally across consecutive missed gameweeks: gameweek N's
carried-forward rows become gameweek N+1's "previous lineup" the next time
this runs, so no special-casing is needed for multiple misses in a row.
"""

import logging
import uuid

from sqlalchemy.orm import Session, joinedload

from app.league.models import (
    FantasyTeam,
    League,
    LeagueSport,
    LineupSlot,
    Sport,
    TeamGameweekLineup,
    TeamPlayer,
    TransferWindow,
)
from app.player.models import Player
from app.squad.services import (
    get_lineup_size_rules,
    get_mixed_starter_requirements,
    validate_lineup_for_league_type,
    validate_position_slots,
)
from app.league.sportConfigs import derive_sport_type

logger = logging.getLogger(__name__)


def carry_forward_missing_lineups(db: Session, window: TransferWindow) -> dict[str, int]:
    """For every team in `window`'s season with no lineup for `window`, try to
    carry forward gameweek (window.number - 1)'s lineup. Returns counts for logging.
    """
    if window.number <= 1:
        return {"checked": 0, "filled": 0, "skipped": 0}

    prior_window = (
        db.query(TransferWindow)
        .filter(
            TransferWindow.season_id == window.season_id,
            TransferWindow.number == window.number - 1,
        )
        .first()
    )
    if prior_window is None:
        return {"checked": 0, "filled": 0, "skipped": 0}

    leagues = db.query(League).filter(League.season_id == window.season_id).all()
    if not leagues:
        return {"checked": 0, "filled": 0, "skipped": 0}

    league_sports_by_league: dict[uuid.UUID, list[Sport]] = {}
    for league in leagues:
        league_sports_by_league[league.id] = (
            db.query(Sport)
            .join(LeagueSport, LeagueSport.sport_id == Sport.id)
            .filter(LeagueSport.league_id == league.id)
            .all()
        )

    teams = (
        db.query(FantasyTeam)
        .filter(FantasyTeam.league_id.in_([league.id for league in leagues]))
        .all()
    )
    leagues_by_id = {league.id: league for league in leagues}

    checked = 0
    filled = 0
    skipped = 0
    for team in teams:
        has_lineup = (
            db.query(TeamGameweekLineup.id)
            .filter(
                TeamGameweekLineup.fantasy_team_id == team.id,
                TeamGameweekLineup.transfer_window_id == window.id,
            )
            .first()
            is not None
        )
        if has_lineup:
            continue

        checked += 1
        league = leagues_by_id[team.league_id]
        league_sports = league_sports_by_league[team.league_id]
        ok = _carry_forward_team_lineup(
            db, team, prior_window.id, window.id, league, league_sports
        )
        if ok:
            filled += 1
            logger.info(
                "Carried forward lineup for team=%s from window=%s to window=%s",
                team.id, prior_window.id, window.id,
            )
        else:
            skipped += 1

    if filled:
        db.flush()

    return {"checked": checked, "filled": filled, "skipped": skipped}


def _carry_forward_team_lineup(
    db: Session,
    team: FantasyTeam,
    from_window_id: uuid.UUID,
    to_window_id: uuid.UUID,
    league: League,
    league_sports: list[Sport],
) -> bool:
    prior_rows = (
        db.query(TeamGameweekLineup)
        .filter(
            TeamGameweekLineup.fantasy_team_id == team.id,
            TeamGameweekLineup.transfer_window_id == from_window_id,
        )
        .all()
    )
    if not prior_rows:
        return False  # team had no lineup last window either — nothing to copy

    active_squad = (
        db.query(TeamPlayer)
        .options(joinedload(TeamPlayer.player))
        .filter(
            TeamPlayer.fantasy_team_id == team.id,
            TeamPlayer.released_window_id.is_(None),
        )
        .all()
    )
    active_player_ids = {tp.player_id for tp in active_squad}
    player_by_id: dict[uuid.UUID, Player] = {tp.player_id: tp.player for tp in active_squad}

    prior_captain_id = next((r.player_id for r in prior_rows if r.is_captain), None)
    prior_vice_id = next((r.player_id for r in prior_rows if r.is_vice_captain), None)
    prior_starter_ids = [r.player_id for r in prior_rows if r.is_starter]
    prior_bench_ids = [
        r.player_id
        for r in sorted(
            (r for r in prior_rows if not r.is_starter),
            key=lambda r: r.bench_order if r.bench_order is not None else 0,
        )
    ]

    # Priority pool for filling starting slots: still-owned prior starters
    # first (in their original order), then still-owned prior bench (in
    # auto-sub order) as replacements for whoever was dropped.
    pool = [pid for pid in prior_starter_ids if pid in active_player_ids] + [
        pid for pid in prior_bench_ids if pid in active_player_ids
    ]

    rules = get_lineup_size_rules(league_sports)
    if rules is None:
        return False  # unrecognised sport combination, no rules to satisfy

    sport_type = derive_sport_type(league_sports)
    if sport_type == "mixed":
        new_starter_ids = _select_mixed_starters(pool, player_by_id, league_sports)
    else:
        new_starter_ids = pool[: rules["starting"]] if len(pool) >= rules["starting"] else None
    if new_starter_ids is None:
        return False  # not enough eligible players left to field a valid lineup

    # Bench = remaining pool, plus any owned squad player who was in neither
    # the prior starting XI nor bench at all (e.g. a fresh transfer-in) -
    # mirrors update_lineup()'s own "fill remaining bench from squad" step.
    prior_ids_seen = set(prior_starter_ids) | set(prior_bench_ids)
    remaining_pool = [pid for pid in pool if pid not in new_starter_ids]
    extra_squad_ids = [
        tp.player_id
        for tp in sorted(active_squad, key=lambda tp: tp.created_at)
        if tp.player_id not in prior_ids_seen and tp.player_id not in new_starter_ids
    ]
    new_bench_ids = remaining_pool + extra_squad_ids

    new_captain_id = _resolve_captain(prior_captain_id, prior_vice_id, new_starter_ids, player_by_id)
    if new_captain_id is None:
        return False  # shouldn't happen (every rule set has >=2 starters), guard anyway
    new_vice_id = _resolve_vice(prior_vice_id, new_captain_id, new_starter_ids, player_by_id)
    if new_vice_id is None:
        return False

    starter_players = [player_by_id[pid] for pid in new_starter_ids]
    lineup_slots = db.query(LineupSlot).filter(LineupSlot.league_id == league.id).all()
    try:
        validate_lineup_for_league_type(starter_players, league, league_sports)
        validate_position_slots(starter_players, lineup_slots)
    except ValueError as exc:
        logger.info(
            "Carry-forward validation failed for team=%s window=%s: %s",
            team.id, to_window_id, exc,
        )
        return False

    for pid in new_starter_ids:
        db.add(TeamGameweekLineup(
            fantasy_team_id=team.id,
            transfer_window_id=to_window_id,
            player_id=pid,
            is_captain=(pid == new_captain_id),
            is_vice_captain=(pid == new_vice_id),
            is_starter=True,
            bench_order=None,
            is_carried_forward=True,
        ))
    for order, pid in enumerate(new_bench_ids):
        db.add(TeamGameweekLineup(
            fantasy_team_id=team.id,
            transfer_window_id=to_window_id,
            player_id=pid,
            is_captain=False,
            is_vice_captain=False,
            is_starter=False,
            bench_order=order,
            is_carried_forward=True,
        ))
    return True


def _select_mixed_starters(
    pool: list[uuid.UUID],
    player_by_id: dict[uuid.UUID, Player],
    league_sports: list[Sport],
) -> list[uuid.UUID] | None:
    """Greedily fill each sport's exact starter quota from `pool`, in priority
    order. Returns None if the pool can't fill every sport's quota."""
    requirements = get_mixed_starter_requirements()
    sport_id_by_name = {
        s.name.strip().lower(): s.id for s in league_sports if getattr(s, "name", None)
    }

    selected: list[uuid.UUID] = []
    counts = {name: 0 for name in requirements}
    for pid in pool:
        player = player_by_id.get(pid)
        if player is None:
            continue
        for sport_name, required in requirements.items():
            sport_id = sport_id_by_name.get(sport_name)
            if (
                sport_id is not None
                and player.sport_id == sport_id
                and counts[sport_name] < required
            ):
                selected.append(pid)
                counts[sport_name] += 1
                break

    if all(counts[name] == requirements[name] for name in requirements):
        return selected
    return None


def _resolve_captain(
    prior_captain_id: uuid.UUID | None,
    prior_vice_id: uuid.UUID | None,
    new_starter_ids: list[uuid.UUID],
    player_by_id: dict[uuid.UUID, Player],
) -> uuid.UUID | None:
    if prior_captain_id in new_starter_ids:
        return prior_captain_id
    if prior_vice_id in new_starter_ids:
        return prior_vice_id
    if not new_starter_ids:
        return None
    # Both captain and vice were dropped since last gameweek - deterministic
    # fallback so captaincy (and its scoring bonus) is never silently unset.
    return max(new_starter_ids, key=lambda pid: player_by_id[pid].cost)


def _resolve_vice(
    prior_vice_id: uuid.UUID | None,
    new_captain_id: uuid.UUID,
    new_starter_ids: list[uuid.UUID],
    player_by_id: dict[uuid.UUID, Player],
) -> uuid.UUID | None:
    if prior_vice_id in new_starter_ids and prior_vice_id != new_captain_id:
        return prior_vice_id
    remaining = [pid for pid in new_starter_ids if pid != new_captain_id]
    if not remaining:
        return None
    return max(remaining, key=lambda pid: player_by_id[pid].cost)

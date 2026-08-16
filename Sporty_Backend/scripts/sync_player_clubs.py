"""Reconcile football club assignments against current API-Football squads.

WHY THIS SOURCE
---------------
Club membership drifts every transfer window. The two scripts this replaces
(`sync_squads_football_data.py`, deleted, and the club side-effect of
`reseed_prices_from_fpl.py`) both matched players by FUZZY NAME, which mixes up
same-named players, and both indexed ONE competition at a time — so a
Bundesliga -> La Liga move looked like "departed" and got the player
deactivated instead of transferred.

This matches on `Player.external_api_id`, the API-Football player id, which is
stable and unique. 1,628 of the 1,706 in-scope players carry one (100% of La
Liga and Bundesliga). Nothing is matched by player name.

`players/squads?team=` is the one roster endpoint the free plan still answers
for the live season — `teams?season=2026` and `players?league&season=2026` are
both refused — and it takes no season parameter, so it returns the squad as it
stands today. That is exactly what transfer reconciliation needs.

WHAT IT WRITES
--------------
Club assignment and availability only — `real_team`, `real_team_id`,
`real_team_logo_url`, `is_available`. Prices stay owned by
app/services/pricing/repricing.py and positions are left alone (the providers
disagree constantly about outfield roles).

  * in one of the 58 squads, different club  -> transfer (cross-league moves
    included: the squad map spans all three competitions at once)
  * in a squad, same club                    -> re-activate if it was off
  * in NO squad                              -> FLAGGED for review, not
    deactivated — see ABSENCE_IS_WEAK_EVIDENCE. `--deactivate-missing` opts in.
  * no numeric external_api_id               -> FLAGGED, never touched

Flagged players are actioned by hand in /admin/players, which can now set both
club and availability (app/admin/services.py::edit_player).

QUOTA
-----
~61 requests against the 95/day budget: 3 `teams?league&season=2024` lookups
plus one squad call per club. The API also caps 10 requests/minute, so calls
are paced ~6.5s apart and a full run takes ~7 minutes. Responses cache for 24h
(`_SEASON_TTL`), so a dry run followed by `--apply` the same day costs nothing
extra. Run it on a non-matchday.

Run manually (verify with the default dry-run first):
    venv/bin/python scripts/sync_player_clubs.py
    venv/bin/python scripts/sync_player_clubs.py --apply
"""
from __future__ import annotations

import argparse
import asyncio
import json
import re
import sys
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import app.main  # noqa: F401 — registers all model modules so relationships resolve

from app.core.config import settings
from app.database import SessionLocal
from app.external_apis.football_api import FootballAPIClient, quota_used_today
from app.league.models import Sport
from app.player import read_cache as player_read_cache
from app.player.models import Player, RealTeam
from app.services.sync.football_competitions import fantasy_competitions

# API-Football allows 10 requests/minute on the free plan and the client raises
# FootballQuotaExhausted rather than backing off, so pace the calls ourselves.
REQUEST_INTERVAL_SECONDS = 6.5

# The 2024 team lists (the newest the free plan serves) are the cheap bulk
# source for club ids — 3 requests for ~41 of our 58 clubs. The rest are clubs
# that were outside those top flights in 2024, mostly since promoted. Their ids
# were resolved once via the season-independent `teams?search=` endpoint and
# pinned here so every run stays at 3 lookups instead of ~20.
# Verified against the search endpoint 2026-08-16. Same maintenance burden as
# _FDO_NAME_ALIASES in app/services/sync/match_sync.py: update on promotion.
TEAM_ID_OVERRIDES: dict[str, int] = {
    # EPL — name variants plus promoted clubs
    "Brighton & Hove Albion": 51,
    "Coventry City": 1346,
    "Hull City": 64,
    "Ipswich Town": 57,
    "Leeds United": 63,
    "Newcastle United": 34,
    "Sunderland": 746,
    "Tottenham Hotspur": 47,
    # La Liga
    "Deportivo La Coruna": 544,
    "Elche": 797,
    "Levante": 539,
    "Malaga": 535,
    "Racing Santander": 4665,
    # Bundesliga
    "1. FC Köln": 192,
    "FC Schalke 04": 174,
    "Hamburger SV": 175,
    "SC Paderborn 07": 185,
}

# ABSENCE_IS_WEAK_EVIDENCE
# ------------------------
# Being in another club's squad is POSITIVE evidence and is applied outright.
# Being in NO squad is not evidence of anything much: this endpoint silently
# omits current players. The 2026-07-24 run of scripts/backfill_missing_scorers
# .py existed precisely because /players/squads had left out Lewandowski,
# Griezmann, Lukebakio, Pléa and Arambarri — and a 2026-08-16 dry run of THIS
# script proposed deactivating all five again, alongside ter Stegen, Chalobah
# and Mastantuono. 65 proposed departures, with the false positives dominated by
# well-known first-teamers.
#
# So absence is reported, never acted on, unless --deactivate-missing is passed.
# Confirm those in /admin/players instead. Do not flip the default without a
# second, independent source agreeing the player has gone.
#
# The squad-size floor below is a separate, narrower guard: when a club's squad
# comes back implausibly short the whole club is untrustworthy, not just one
# player (2026-08-15: Atlético Madrid returned 5 while every other La Liga club
# returned 18-31).
MIN_TRUSTWORTHY_SQUAD = 15


def fold(name: str) -> str:
    """Mirror the uq_players_identity index expression.

    The index is (sport_id, lower(regexp_replace(btrim(name),'\\s+',' ','g')),
    real_team_id). Deliberately NOT name_matching.normalize(), which also strips
    accents — that is more aggressive than the index and would reject moves the
    database would happily accept.
    """
    return re.sub(r"\s+", " ", (name or "").strip()).lower()


@dataclass(frozen=True)
class ClubRef:
    """A club, detached from the ORM.

    The feed phase takes ~7 minutes at the rate cap and Neon drops connections
    that idle that long, so the database session is closed before any HTTP call
    and reopened afterwards. Plain values survive that; ORM instances bound to a
    dead session do not.
    """
    id: uuid.UUID
    name: str
    competition: str
    logo_url: str | None


@dataclass(frozen=True)
class SquadEntry:
    """Where the feed says a player currently plays."""
    club_name: str
    club_id: uuid.UUID
    competition: str


@dataclass
class Decision:
    action: str  # transfer | deactivate | reactivate | flag
    player_id: uuid.UUID
    player_name: str
    external_api_id: str | None
    old_club: str
    new_club: str | None = None
    new_club_id: uuid.UUID | None = None
    note: str = ""

    def outcome(self) -> str | None:
        """Human-readable right-hand side of the change log."""
        return {
            "transfer": self.new_club,
            "deactivate": "is_available: false",
            "reactivate": "is_available: true",
        }.get(self.action)

    def as_log(self) -> dict:
        row = {
            "action": self.action,
            "player": self.player_name,
            "external_api_id": self.external_api_id,
            "from": self.old_club,
        }
        outcome = self.outcome()
        if outcome:
            row["to"] = outcome
        if self.note:
            row["note"] = self.note
        return row


def reconcile(
    players,
    squad_map: dict[str, SquadEntry],
    squad_sizes: dict[uuid.UUID, int],
    occupied: dict[tuple[str, uuid.UUID], uuid.UUID],
    *,
    min_squad: int = MIN_TRUSTWORTHY_SQUAD,
    deactivate_missing: bool = False,
) -> list[Decision]:
    """Decide what to do with each player. Pure — no DB, no network.

    `players` only needs the attributes id/name/external_api_id/real_team/
    real_team_id/is_available, so tests can pass plain objects.
    `occupied` mirrors uq_players_identity: (folded name, club id) -> player id.

    `deactivate_missing` is OFF by default and should stay off. See
    ABSENCE_IS_WEAK_EVIDENCE below.
    """
    decisions: list[Decision] = []

    for player in players:
        external = (player.external_api_id or "").strip()
        base = dict(
            player_id=player.id,
            player_name=player.name,
            external_api_id=player.external_api_id,
            old_club=player.real_team,
        )

        # Legacy slug ids ("football:marc_cucurella:chelsea:def") cannot be
        # joined to the feed. Guessing by name is the failure mode this script
        # exists to remove, so they are reported for the admin UI instead.
        if not external.isdigit():
            decisions.append(Decision(
                action="flag", note="no numeric API-Football id — resolve in /admin/players", **base
            ))
            continue

        entry = squad_map.get(external)

        if entry is None:
            if not player.is_available:
                continue  # already off; don't re-log the same absence every run
            size = squad_sizes.get(player.real_team_id, 0)
            if size < min_squad:
                decisions.append(Decision(
                    action="flag",
                    note=f"absent from all squads, but {player.real_team} returned only "
                         f"{size} players — provider gap, not a departure",
                    **base,
                ))
            elif deactivate_missing:
                decisions.append(Decision(
                    action="deactivate", note="in none of the supported leagues' squads", **base
                ))
            else:
                decisions.append(Decision(
                    action="flag",
                    note="absent from every squad — possible departure, but this feed "
                         "also omits current players; confirm before deactivating",
                    **base,
                ))
            continue

        if entry.club_id == player.real_team_id:
            if not player.is_available:
                decisions.append(Decision(
                    action="reactivate", note="back in the squad", **base
                ))
            continue

        # uq_players_identity is (sport, folded name, club): moving onto a club
        # that already has that name aborts the WHOLE transaction and takes
        # every other transfer down with it. A genuine duplicate needs a merge
        # migration, not a silent overwrite.
        holder = occupied.get((fold(player.name), entry.club_id))
        if holder is not None and holder != player.id:
            decisions.append(Decision(
                action="flag",
                note=f"would move to {entry.club_name}, which already has a player of that name",
                **base,
            ))
            continue

        occupied[(fold(player.name), entry.club_id)] = player.id
        occupied.pop((fold(player.name), player.real_team_id), None)
        decisions.append(Decision(
            action="transfer", new_club=entry.club_name, new_club_id=entry.club_id, **base
        ))

    return decisions


async def _paced(client: FootballAPIClient, coro_factory, first: bool = False):
    if not first:
        await asyncio.sleep(REQUEST_INTERVAL_SECONDS)
    return await coro_factory()


async def resolve_team_ids(client: FootballAPIClient, clubs: list[ClubRef]) -> dict[uuid.UUID, int]:
    """Map each of our tagged clubs to its API-Football team id."""
    by_name: dict[str, int] = {}
    for index, league_id in enumerate(fantasy_competitions()):
        payload = await _paced(
            client, lambda lid=league_id: client.get_teams(league_id=lid, season=2024), first=index == 0
        )
        for item in payload.get("response") or []:
            team = item.get("team") or {}
            if team.get("name") and team.get("id"):
                by_name[team["name"]] = team["id"]

    resolved: dict[uuid.UUID, int] = {}
    unresolved: list[str] = []
    for club in clubs:
        team_id = TEAM_ID_OVERRIDES.get(club.name) or by_name.get(club.name)
        if team_id is None:
            unresolved.append(f"{club.competition}: {club.name}")
        else:
            resolved[club.id] = team_id

    if unresolved:
        # Abort rather than run on a partial universe: every player of an
        # unresolved club would be absent from the squad map and deactivated.
        raise SystemExit(
            "Could not resolve an API-Football team id for:\n  "
            + "\n  ".join(unresolved)
            + "\n\nAdd them to TEAM_ID_OVERRIDES (find the id with "
              "`teams?search=<name>`) and re-run."
        )
    return resolved


async def fetch_squads(
    client: FootballAPIClient, clubs: list[ClubRef], team_ids: dict[uuid.UUID, int]
) -> tuple[dict[str, SquadEntry], dict[uuid.UUID, int]]:
    squad_map: dict[str, SquadEntry] = {}
    squad_sizes: dict[uuid.UUID, int] = {}

    for club in clubs:
        team_id = team_ids[club.id]
        payload = await _paced(client, lambda tid=team_id: client.get_squads(tid))
        response = payload.get("response") or []
        if not response:
            raise SystemExit(
                f"Empty squad for {club.name} (team {team_id}). Aborting rather than "
                "treating its whole roster as departed."
            )

        block = response[0]
        # Catches a wrong id in TEAM_ID_OVERRIDES: a mistyped id returns a real,
        # full squad for the WRONG club, which would silently deactivate every
        # player of this one.
        returned = ((block.get("team") or {}).get("id"))
        if returned != team_id:
            raise SystemExit(
                f"Asked for team {team_id} ({club.name}) but got {returned} "
                f"({(block.get('team') or {}).get('name')}). Fix TEAM_ID_OVERRIDES."
            )

        members = block.get("players") or []
        squad_sizes[club.id] = len(members)
        for member in members:
            member_id = member.get("id")
            if member_id is not None:
                squad_map[str(member_id)] = SquadEntry(club.name, club.id, club.competition)
        print(f"  {club.competition:11} {club.name:28} {len(members):>3} players")

    return squad_map, squad_sizes


def main() -> int:
    global REQUEST_INTERVAL_SECONDS

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Commit the changes.")
    parser.add_argument(
        "--out",
        default=None,
        help="Change-log path (default: player_club_changes_<UTC stamp>.json).",
    )
    parser.add_argument(
        "--deactivate-missing",
        action="store_true",
        help="Set is_available=False on players absent from every squad. OFF by "
             "default — read ABSENCE_IS_WEAK_EVIDENCE before using it.",
    )
    parser.add_argument(
        "--ignore-budget",
        action="store_true",
        help="Run even when the projected spend eats into the match-day reserve.",
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=REQUEST_INTERVAL_SECONDS,
        help="Seconds between API calls (default %(default)s, for the 10/min cap). "
             "Use 0 to re-run within the 24h response cache, where nothing is "
             "actually requested.",
    )
    args = parser.parse_args()
    REQUEST_INTERVAL_SECONDS = args.interval

    tags = {c.tag for c in fantasy_competitions().values()}

    # Phase 1 — read the club list, then let the connection go. Everything
    # below the feed call must not depend on this session.
    db = SessionLocal()
    try:
        sport_id = db.query(Sport.id).filter(Sport.name == "football").one()[0]
        clubs = [
            ClubRef(row.id, row.name, row.competition, row.logo_url)
            for row in db.query(RealTeam)
            .filter(RealTeam.sport_id == sport_id, RealTeam.competition.in_(tags))
            .order_by(RealTeam.competition, RealTeam.name)
        ]
    finally:
        db.close()
    print(f"clubs: {len(clubs)}")

    # This run and the match-day tasks share ONE 95/day budget, and everything
    # match-day (pre-match lineups, FT team stats) silently yields once spend
    # passes budget - FOOTBALL_LINEUP_QUOTA_RESERVE. Run it on 2026-08-16 and
    # that day's fixtures get no lineups and no stat sheet — which is exactly
    # what happened. Costs nothing on a re-run inside the 24h response cache,
    # but the projection can't tell those apart, hence --ignore-budget.
    projected = quota_used_today() + len(clubs) + 3
    floor = settings.FOOTBALL_API_DAILY_BUDGET - settings.FOOTBALL_LINEUP_QUOTA_RESERVE
    if settings.FOOTBALL_API_DAILY_BUDGET > 0 and projected > floor and not args.ignore_budget:
        raise SystemExit(
            f"Projected spend {projected} would cross the match-day reserve "
            f"({floor} of {settings.FOOTBALL_API_DAILY_BUDGET}; "
            f"{quota_used_today()} already spent today). Run after 00:00 UTC on a "
            "non-matchday, or pass --ignore-budget if you know today has no fixtures."
        )

    # Phase 2 — the feed. Minutes long, so no database session is held: Neon
    # closes idle connections and the reconcile below would die on a dead socket.
    client = FootballAPIClient()
    print(f"\nFetching feed (~{len(clubs) + 3} requests, "
          f"~{(len(clubs) + 3) * REQUEST_INTERVAL_SECONDS / 60:.0f} min at the 10/min cap)...")

    async def gather():
        team_ids = await resolve_team_ids(client, clubs)
        print("\nCurrent squads:")
        return await fetch_squads(client, clubs, team_ids)

    squad_map, squad_sizes = asyncio.run(gather())
    print(f"\nsquad map: {len(squad_map)} players across {len(squad_sizes)} clubs")

    # Phase 3 — reconcile and write on a fresh connection.
    db = SessionLocal()
    try:
        club_ids = [club.id for club in clubs]
        players = (
            db.query(Player)
            .filter(Player.sport_id == sport_id, Player.real_team_id.in_(club_ids))
            .all()
        )
        print(f"players in scope: {len(players)}")

        clubs_by_id = {club.id: club for club in clubs}
        occupied = {
            (fold(name), real_team_id): player_id
            for player_id, name, real_team_id in db.query(
                Player.id, Player.name, Player.real_team_id
            ).filter(Player.sport_id == sport_id)
        }

        decisions = reconcile(
            players, squad_map, squad_sizes, occupied,
            deactivate_missing=args.deactivate_missing,
        )
        by_id = {player.id: player for player in players}

        buckets: dict[str, list[Decision]] = {}
        for decision in decisions:
            buckets.setdefault(decision.action, []).append(decision)

        for action in ("transfer", "deactivate", "reactivate", "flag"):
            rows = buckets.get(action, [])
            print(f"\n=== {action.upper()} ({len(rows)}) ===")
            for decision in rows:
                suffix = f"   [{decision.note}]" if decision.note else ""
                outcome = decision.outcome()
                arrow = f" -> {outcome}" if outcome else ""
                print(f"  {decision.player_name}: {decision.old_club}{arrow}{suffix}")

        for decision in decisions:
            player = by_id[decision.player_id]
            if decision.action == "transfer":
                target = clubs_by_id[decision.new_club_id]
                # real_team (the denormalized name) is what every name-matching
                # path reads, and the logo is copied onto the player row — all
                # three move together or the pool goes inconsistent.
                player.real_team_id = target.id
                player.real_team = target.name
                player.real_team_logo_url = target.logo_url
                player.is_available = True
            elif decision.action == "deactivate":
                player.is_available = False
            elif decision.action == "reactivate":
                player.is_available = True

        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        out_path = Path(args.out or f"player_club_changes_{stamp}.json")
        out_path.write_text(json.dumps({
            "generated_at": stamp,
            "applied": bool(args.apply),
            "counts": {action: len(rows) for action, rows in buckets.items()},
            "changes": [d.as_log() for d in decisions],
        }, indent=2, ensure_ascii=False))
        print(f"\nChange log: {out_path}")

        if not args.apply:
            db.rollback()
            print("DRY RUN — nothing written. Re-run with --apply to commit.")
            return 0

        db.commit()
        player_read_cache.bust_all()
        print("Committed, player read cache busted.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())

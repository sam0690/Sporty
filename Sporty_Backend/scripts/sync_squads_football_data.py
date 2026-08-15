"""Reconcile La Liga / Bundesliga club assignments against football-data.org.

WHY THIS SOURCE
---------------
API-Football is the usual roster source, but this account's free plan is
capped at seasons 2022-2024 — requesting the live 2026/27 season returns
"Free plans do not have access to this season", so `sync_football_players`
cannot see current squads at all. football-data.org's competition-teams
endpoint returns every club WITH its squad for the current season in ONE
request per competition (2 total, versus ~54 paginated API-Football calls),
and its token is already configured.

WHAT IT DOES
------------
Club assignment only — `real_team` and `real_team_id`. Prices, positions and
squad membership are deliberately untouched:

  * prices are owned by app/services/pricing/repricing.py
  * football-data.org positions use a different vocabulary
    (Goalkeeper/Defence/Midfield/Offence) than our GKP/DEF/MID/FWD, and a bad
    mapping silently breaks squad validation and auto-pick

Players our pool has but the feed's squads don't are only REPORTED by default
— they may be departed, or merely omitted by the provider. Pass
--deactivate-missing to act on them, which is the same treatment
scripts/reseed_prices_from_fpl.py gives the Premier League pool.

Matching is by name (app/services/sync/name_matching.py): our pool carries
API-Football ids while this feed uses its own, so there is no shared key.
Club names are reconciled with the existing `_fdo_team_name` alias map in
app/services/sync/match_sync.py, which already covers both competitions.

Run manually (verify with the default dry-run first):
    venv/bin/python scripts/sync_squads_football_data.py
    venv/bin/python scripts/sync_squads_football_data.py --apply
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import httpx

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import app.main  # noqa: F401 — registers all model modules so relationships resolve

from app.core.config import settings
from app.database import SessionLocal
from app.league.models import Sport
from app.player.models import Player, RealTeam
from app.services.sync.match_sync import _fdo_team_name
from app.services.sync.name_matching import Candidate, NameIndex, normalize

FDO_BASE_URL = "https://api.football-data.org/v4"

# football-data.org competition code -> our RealTeam.competition tag.
# Mirrors app/services/sync/football_competitions.py; the Premier League is
# excluded on purpose — FPL is a better source for it and already owns that
# pool (scripts/reseed_prices_from_fpl.py).
COMPETITIONS = {
    "PD": "LALIGA",
    "BL1": "BUNDESLIGA",
}

# A transfer is inferred from absence: the player is missing from their current
# club's squad and present in another's. That inference is only valid if the
# current club's squad is actually complete in the feed — and it sometimes is
# not (2026-08-15: Atlético Madrid came back with 5 players while every other
# La Liga club had 18-31). Below this floor, absence means "provider gap", not
# "left the club", so the move is reported and skipped rather than written.
MIN_TRUSTWORTHY_SQUAD = 15

def _positions_conflict(ours: str | None, feed_position: str | None) -> bool:
    """True only for a goalkeeper/outfield contradiction.

    Motivated by a real false match: the pool holds a goalkeeper "Álvaro
    Fernández" at Deportivo and a defender of the same name at Real Madrid,
    and without this the defender was "transferred" onto the goalkeeper's club
    (tripping uq_players_identity and rolling back every other transfer).

    Deliberately NOT a full position comparison. The two providers disagree
    constantly about outfield roles — Grifo, Olise and Doan are all MID here
    and "Offence" upstream, Laimer is MID here and "Defence" upstream — so
    treating any mismatch as a conflict rejects a couple of dozen perfectly
    good matches. Only goalkeeper is unambiguous in both vocabularies.
    """
    if not ours or not feed_position:
        return False
    ours_is_keeper = ours.strip().upper() in {"GKP", "GK"}
    feed_is_keeper = feed_position.strip() == "Goalkeeper"
    return ours_is_keeper != feed_is_keeper


def fetch_squads(code: str, season: int, token: str) -> list[dict]:
    response = httpx.get(
        f"{FDO_BASE_URL}/competitions/{code}/teams",
        params={"season": season},
        headers={"X-Auth-Token": token},
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()
    if "teams" not in payload:
        raise RuntimeError(f"{code}: unexpected response {payload}")
    return payload["teams"]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Commit the changes.")
    parser.add_argument(
        "--deactivate-missing",
        action="store_true",
        help="Also set is_available=False on players absent from every squad.",
    )
    parser.add_argument("--season", type=int, default=2026)
    args = parser.parse_args()

    token = settings.FOOTBALL_DATA_ORG_TOKEN or os.getenv("FOOTBALL_DATA_ORG_TOKEN", "")
    if not token:
        print("FOOTBALL_DATA_ORG_TOKEN is not set.")
        return 1

    db = SessionLocal()
    try:
        sport = db.query(Sport).filter(Sport.name == "football").one()
        clubs_by_name = {
            normalize(team.name): team
            for team in db.query(RealTeam).filter(RealTeam.sport_id == sport.id).all()
        }
        # Mirrors the uq_players_identity index so a collision is caught before
        # it reaches the database and rolls back every other transfer with it.
        occupied = {
            (normalize(name), real_team_id): player_id
            for player_id, name, real_team_id in db.query(
                Player.id, Player.name, Player.real_team_id
            ).filter(Player.sport_id == sport.id)
        }

        total_transferred = 0
        total_missing = 0
        total_deactivated = 0

        for code, tag in COMPETITIONS.items():
            teams = fetch_squads(code, args.season, token)
            squad_count = sum(len(t.get("squad", [])) for t in teams)
            print(f"\n=== {tag} — feed: {len(teams)} clubs, {squad_count} players ===")

            squad_sizes = {
                _fdo_team_name(team["name"]): len(team.get("squad", []))
                for team in teams
            }
            index = NameIndex.build(
                Candidate.from_full_name(
                    member["name"],
                    club=_fdo_team_name(team["name"]),
                    payload=(member, _fdo_team_name(team["name"])),
                )
                for team in teams
                for member in team.get("squad", [])
            )

            players = (
                db.query(Player)
                .join(RealTeam, RealTeam.id == Player.real_team_id)
                .filter(Player.sport_id == sport.id, RealTeam.competition == tag)
                .all()
            )
            print(f"our pool: {len(players)} players")

            transferred = 0
            missing: list[Player] = []
            unresolved: list[str] = []
            untrusted: list[str] = []
            impostors: list[str] = []
            collisions: list[str] = []

            for player in players:
                matched = index.match(player.name, club=player.real_team)
                if matched is None:
                    missing.append(player)
                    continue

                member, feed_club = matched
                if _positions_conflict(player.position, member.get("position")):
                    impostors.append(
                        f"{player.name} ({player.position}) vs feed "
                        f"{member['name']} ({member.get('position')}) at {feed_club}"
                    )
                    continue

                if normalize(feed_club) == normalize(player.real_team or ""):
                    continue

                current_squad = squad_sizes.get(_fdo_team_name(player.real_team or ""), 0)
                if current_squad < MIN_TRUSTWORTHY_SQUAD:
                    untrusted.append(
                        f"{player.name}: {player.real_team} -> {feed_club} "
                        f"(old club listed only {current_squad} players)"
                    )
                    continue

                target = clubs_by_name.get(normalize(feed_club))
                if target is None:
                    # Never auto-create: a RealTeam with competition=NULL drops
                    # its players out of every competition-scoped pool.
                    unresolved.append(f"{player.name}: {player.real_team} -> {feed_club}")
                    continue

                # uq_players_identity is (sport, folded name, real_team_id), so
                # moving someone onto a club that already has that name aborts
                # the WHOLE transaction. Skip and report instead — a genuine
                # duplicate needs a merge migration, not a silent overwrite.
                occupant = occupied.get((normalize(player.name), target.id))
                if occupant is not None and occupant != player.id:
                    collisions.append(
                        f"{player.name}: {player.real_team} -> {target.name} "
                        f"(a player of that name is already there)"
                    )
                    continue

                print(f"  transfer: {player.name}: {player.real_team} -> {target.name}")
                player.real_team = target.name
                player.real_team_id = target.id
                transferred += 1

            print(f"  transfers: {transferred}   absent from feed squads: {len(missing)}")
            if untrusted:
                print(f"  SKIPPED as untrustworthy ({len(untrusted)}):")
                for line in untrusted:
                    print(f"    {line}")
            if impostors:
                print(f"  REJECTED, same name different position ({len(impostors)}):")
                for line in impostors:
                    print(f"    {line}")
            if collisions:
                print(f"  SKIPPED, name already taken at target club ({len(collisions)}):")
                for line in collisions:
                    print(f"    {line}")
            if unresolved:
                print(f"  unresolved clubs ({len(unresolved)}) — left on current club:")
                for line in unresolved[:10]:
                    print(f"    {line}")

            if args.deactivate_missing:
                for player in missing:
                    if player.is_available:
                        player.is_available = False
                        total_deactivated += 1

            total_transferred += transferred
            total_missing += len(missing)

        print(f"\nTotal transfers      : {total_transferred}")
        print(f"Total absent from feed: {total_missing}")
        if args.deactivate_missing:
            print(f"Total deactivated     : {total_deactivated}")
        else:
            print("(absent players left active — pass --deactivate-missing to change)")

        if not args.apply:
            db.rollback()
            print("\nDRY RUN — nothing written. Re-run with --apply to commit.")
            return 0

        db.commit()
        print("\nCommitted.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())

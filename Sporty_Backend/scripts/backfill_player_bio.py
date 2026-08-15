"""Backfill player nationality and date of birth from football-data.org.

WHY THESE TWO FIELDS AND NOT THE REST
-------------------------------------
`Player` carries nationality, date_of_birth, height, weight and
jersey_number. Only the first two are obtainable from a free data source:

  * football-data.org's competition-teams endpoint returns nationality and
    dateOfBirth for 100% of squad members, for all three of our competitions,
    in ONE request each.
  * height and weight exist only on API-Football, which bills one request per
    player against a 95/day budget (`FOOTBALL_API_DAILY_BUDGET`) — ~1780
    requests, so ~19 days.
  * jersey_number exists on football-data.org's /persons/{id}, also one
    request per player, but free at 10/min (~3 hours for the pool). Not done
    here; see the note at the bottom of this docstring.

TheSportsDB, which `scripts/backfill_player_team_images.py` uses for this
enrichment, returns null for strHeight/strWeight/strNumber on the free tier —
which is why those three columns are empty for every player in the pool
despite that script setting them.

Matching is by name (app/services/sync/name_matching.py); our pool carries
API-Football ids while this feed uses its own, so there is no shared key. A
goalkeeper/outfield disagreement vetoes a match, which keeps different people
who share a name apart.

Run manually (verify with the default dry-run first):
    venv/bin/python scripts/backfill_player_bio.py
    venv/bin/python scripts/backfill_player_bio.py --apply
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import date, datetime
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
from app.services.sync.name_matching import Candidate, NameIndex
from app.services.sync.nationalities import iso_code

FDO_BASE_URL = "https://api.football-data.org/v4"

# football-data.org competition code -> our RealTeam.competition tag.
COMPETITIONS = {
    "PL": "EPL",
    "PD": "LALIGA",
    "BL1": "BUNDESLIGA",
}


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


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.strptime(value[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def _is_keeper(position: str | None) -> bool:
    return (position or "").strip().upper() in {"GKP", "GK"}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Commit the changes.")
    parser.add_argument("--season", type=int, default=2026)
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Replace existing values. Default only fills in NULLs.",
    )
    args = parser.parse_args()

    token = settings.FOOTBALL_DATA_ORG_TOKEN or os.getenv("FOOTBALL_DATA_ORG_TOKEN", "")
    if not token:
        print("FOOTBALL_DATA_ORG_TOKEN is not set.")
        return 1

    db = SessionLocal()
    try:
        sport = db.query(Sport).filter(Sport.name == "football").one()

        set_nationality = 0
        set_dob = 0
        unmatched = 0
        unmapped_flags: set[str] = set()

        for code, tag in COMPETITIONS.items():
            teams = fetch_squads(code, args.season, token)
            members = [
                (member, _fdo_team_name(team["name"]))
                for team in teams
                for member in team.get("squad", [])
            ]
            print(f"\n=== {tag} — feed: {len(teams)} clubs, {len(members)} players ===")

            index = NameIndex.build(
                Candidate.from_full_name(member["name"], club=club, payload=member)
                for member, club in members
            )

            players = (
                db.query(Player)
                .join(RealTeam, RealTeam.id == Player.real_team_id)
                .filter(Player.sport_id == sport.id, RealTeam.competition == tag)
                .all()
            )

            matched = 0
            for player in players:
                member = index.match(player.name, club=player.real_team)
                if member is None:
                    unmatched += 1
                    continue
                if _is_keeper(player.position) != (member.get("position") == "Goalkeeper"):
                    unmatched += 1
                    continue
                matched += 1

                nationality = (member.get("nationality") or "").strip() or None
                if nationality and (args.overwrite or player.nationality is None):
                    if player.nationality != nationality:
                        player.nationality = nationality
                        set_nationality += 1
                    if not iso_code(nationality):
                        unmapped_flags.add(nationality)

                dob = _parse_date(member.get("dateOfBirth"))
                if dob and (args.overwrite or player.date_of_birth is None):
                    if player.date_of_birth != dob:
                        player.date_of_birth = dob
                        set_dob += 1

            print(f"  our pool: {len(players)}   matched: {matched}")

        print(f"\nnationality set : {set_nationality}")
        print(f"date_of_birth set: {set_dob}")
        print(f"unmatched players: {unmatched} (left as-is)")
        if unmapped_flags:
            # A nationality with no ISO code renders no flag, so surface it
            # rather than letting it fail silently in the UI.
            print(f"\nNationalities with no flag mapping ({len(unmapped_flags)}):")
            for name in sorted(unmapped_flags):
                print(f"  {name!r}  -> add to app/services/sync/nationalities.py")

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

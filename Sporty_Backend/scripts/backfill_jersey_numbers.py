"""Backfill Player.jersey_number from football-data.org's /persons endpoint.

WHY IT IS SLOW
--------------
shirtNumber is only on `/persons/{id}` — neither the competition-teams nor the
single-team endpoint carries it, so this is one request per player (~1265 of
them). football-data.org's free tier allows 10 requests/minute, so a full pass
takes roughly two hours. It costs nothing against the API-Football quota,
which is a separate and much scarcer budget.

Person ids are not stored on our side: our pool carries API-Football ids, so
each run first pulls the three competition squads (3 requests) and matches our
players to feed entries by name (app/services/sync/name_matching.py) to learn
the football-data id.

RESUMABLE
---------
Only players whose jersey_number is NULL are fetched, and progress is
committed every COMMIT_EVERY players. Re-running after an interruption picks
up where it stopped rather than starting over — which matters when a full pass
is two hours long. Pass --overwrite to refresh numbers that are already set.

A caveat worth knowing: some person records are stale (the ones sampled on
2026-08-15 carried lastUpdated timestamps from 2023), so a number may reflect
an older season. Numbers that come back null are left null.

Run manually (verify with the default dry-run first):
    venv/bin/python scripts/backfill_jersey_numbers.py
    venv/bin/python scripts/backfill_jersey_numbers.py --apply
"""
from __future__ import annotations

import argparse
import os
import sys
import time
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

FDO_BASE_URL = "https://api.football-data.org/v4"

COMPETITIONS = {
    "PL": "EPL",
    "PD": "LALIGA",
    "BL1": "BUNDESLIGA",
}

# Free tier allows 10 requests/minute. 6.5s leaves headroom for clock skew
# rather than riding exactly on the limit.
REQUEST_INTERVAL_SECONDS = 6.5

# Commit this often so an interrupted two-hour run keeps its progress.
COMMIT_EVERY = 25


def _get(client: httpx.Client, url: str, token: str, retries: int = 3) -> httpx.Response | None:
    """GET with backoff on 429. Returns None if it never succeeded."""
    for attempt in range(retries):
        response = client.get(url, headers={"X-Auth-Token": token}, timeout=30)
        if response.status_code == 429:
            wait = REQUEST_INTERVAL_SECONDS * (attempt + 2)
            print(f"    rate limited, sleeping {wait:.0f}s")
            time.sleep(wait)
            continue
        if response.status_code == 404:
            return None
        response.raise_for_status()
        return response
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
        help="Refetch players that already have a jersey_number.",
    )
    parser.add_argument(
        "--limit", type=int, default=None, help="Stop after this many lookups."
    )
    args = parser.parse_args()

    token = settings.FOOTBALL_DATA_ORG_TOKEN or os.getenv("FOOTBALL_DATA_ORG_TOKEN", "")
    if not token:
        print("FOOTBALL_DATA_ORG_TOKEN is not set.")
        return 1

    db = SessionLocal()
    try:
        sport = db.query(Sport).filter(Sport.name == "football").one()

        with httpx.Client(timeout=30) as client:
            # Phase 1 — learn each player's football-data person id (3 requests).
            targets: list[tuple[Player, int]] = []
            for code, tag in COMPETITIONS.items():
                response = _get(
                    client,
                    f"{FDO_BASE_URL}/competitions/{code}/teams?season={args.season}",
                    token,
                )
                if response is None:
                    print(f"{tag}: could not fetch squads, skipping")
                    continue
                teams = response.json().get("teams", [])
                index = NameIndex.build(
                    Candidate.from_full_name(
                        member["name"],
                        club=_fdo_team_name(team["name"]),
                        payload=member,
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
                matched = 0
                for player in players:
                    if player.jersey_number is not None and not args.overwrite:
                        continue
                    member = index.match(player.name, club=player.real_team)
                    if member is None:
                        continue
                    if _is_keeper(player.position) != (member.get("position") == "Goalkeeper"):
                        continue
                    matched += 1
                    targets.append((player, member["id"]))
                print(f"{tag}: {matched} player(s) to look up")
                time.sleep(REQUEST_INTERVAL_SECONDS)

            if args.limit:
                targets = targets[: args.limit]

            estimate = len(targets) * REQUEST_INTERVAL_SECONDS / 60
            print(f"\nlookups: {len(targets)}  (~{estimate:.0f} min at 10 req/min)")

            if not args.apply:
                print("\nDRY RUN — no person lookups performed, nothing written.")
                print("Re-run with --apply to fetch and commit.")
                return 0

            # Phase 2 — one /persons request each.
            filled = 0
            missing = 0
            for done, (player, person_id) in enumerate(targets, start=1):
                response = _get(client, f"{FDO_BASE_URL}/persons/{person_id}", token)
                if response is not None:
                    number = response.json().get("shirtNumber")
                    if isinstance(number, int):
                        player.jersey_number = number
                        filled += 1
                    else:
                        missing += 1
                else:
                    missing += 1

                if done % COMMIT_EVERY == 0:
                    db.commit()
                    print(f"  {done}/{len(targets)}  filled={filled} missing={missing}")

                if done < len(targets):
                    time.sleep(REQUEST_INTERVAL_SECONDS)

            db.commit()
            print(f"\njersey_number set: {filled}   no number returned: {missing}")
            return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())

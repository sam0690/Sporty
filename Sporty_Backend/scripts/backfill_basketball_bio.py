"""Backfill NBA player height, weight, jersey number and nationality from BallDontLie.

WHY THIS SOURCE
---------------
Every bio column is empty for all 582 basketball players — none of the football
backfills touch them and `sync_basketball_players` only writes name/position/
club. BallDontLie returns height, weight, jersey_number and country for the
whole pool, free, in ~48 paged requests.

NO DATE OF BIRTH
----------------
BallDontLie does not carry one, so `age` stays blank on NBA player cards. The
endpoint that has it (stats.nba.com `commonteamroster`) soft-blocks after about
twenty calls and hangs rather than erroring, which is not a trade worth making
for one field. Left as a known gap.

MATCHING IS BY NAME
-------------------
Our pool carries NBA.com ids (`nba:1630568`); BallDontLie numbers players in
its own namespace, so there is no shared key. `app/services/sync/name_matching.py`
does the join, with the club as tie-breaker — and here the club is exact, not
fuzzy, because `Player.real_team` already stores the same three-letter
abbreviation BallDontLie reports ("BOS", "HOU"). Unmatched players are printed,
never guessed at.

The list is all-time, not active, so it also holds retired players who share a
name with a current one. NameIndex refuses an ambiguous match rather than
picking one, which is the behaviour we want.

Run manually (verify with the default dry-run first):
    venv/bin/python scripts/backfill_basketball_bio.py
    venv/bin/python scripts/backfill_basketball_bio.py --apply
"""
from __future__ import annotations

import argparse
import asyncio
import re
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import app.main  # noqa: F401 — registers all model modules so relationships resolve

from app.core.config import settings
from app.database import SessionLocal
from app.external_apis.basketball_balldontlie import BasketballBallDontLieClient
from app.league.models import Sport
from app.player.models import Player
from app.services.sync.name_matching import Candidate, NameIndex
from app.services.sync.nationalities import iso_code

_FEET_INCHES = re.compile(r"^(\d+)-(\d+)$")


def format_height(value: str | None) -> str | None:
    """BallDontLie's "6-6" as something a player card can show: 6' 6\"."""
    match = _FEET_INCHES.match((value or "").strip())
    if not match:
        return None
    return f"{match.group(1)}' {match.group(2)}\""


def format_weight(value: str | None) -> str | None:
    """Bare pounds ("190") need their unit, or the card reads as a mystery."""
    text = (value or "").strip()
    return f"{text} lb" if text.isdigit() else None


def parse_jersey(value: str | None) -> int | None:
    """The column is an Integer, so "00" lands as 0 — the one lossy conversion
    here, and only for the handful of players who wear it."""
    text = (value or "").strip()
    return int(text) if text.isdigit() else None


def apply_entry(player, entry: dict, *, overwrite: bool = False) -> set[str]:
    """Copy one BallDontLie row onto our player. Returns the fields changed."""
    incoming = {
        "height": format_height(entry.get("height")),
        "weight": format_weight(entry.get("weight")),
        "jersey_number": parse_jersey(entry.get("jersey_number")),
        "nationality": (entry.get("country") or "").strip() or None,
    }
    changed = set()
    for field, value in incoming.items():
        if value is None:
            continue
        current = getattr(player, field)
        if current is not None and not overwrite:
            continue
        if current != value:
            setattr(player, field, value)
            changed.add(field)
    return changed


async def run(args) -> int:
    db = SessionLocal()
    try:
        sport = db.query(Sport).filter(Sport.name == "basketball").one()
        players = (
            db.query(Player)
            .filter(Player.sport_id == sport.id, Player.is_available.is_(True))
            .all()
        )
        print(f"pool: {len(players)} available basketball players")

        client = BasketballBallDontLieClient(settings.BALLDONTLIE_API_KEY)
        feed = await client.get_all_players(use_cache=not args.no_cache)
        print(f"feed: {len(feed)} BallDontLie players")
        if not feed:
            print("Empty feed — nothing to do.")
            return 1

        index = NameIndex.build(
            Candidate.from_full_name(
                f"{entry.get('first_name', '')} {entry.get('last_name', '')}",
                club=(entry.get("team") or {}).get("abbreviation"),
                payload=entry,
            )
            for entry in feed
        )

        counts = dict.fromkeys(("height", "weight", "jersey_number", "nationality"), 0)
        matched = 0
        unmatched: list[Player] = []
        unmapped_flags: set[str] = set()

        for player in players:
            entry = index.match(player.name, club=player.real_team)
            if entry is None:
                unmatched.append(player)
                continue
            matched += 1
            for field in apply_entry(player, entry, overwrite=args.overwrite):
                counts[field] += 1
            if player.nationality and not iso_code(player.nationality):
                unmapped_flags.add(player.nationality)

        print(f"\nmatched: {matched}/{len(players)}")
        for field, count in counts.items():
            print(f"  {field:15} {count}")

        if unmatched:
            print(f"\nUnmatched ({len(unmatched)}) — left as-is:")
            for player in unmatched:
                print(f"  {player.name} ({player.real_team})")

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
        from app.player import read_cache as player_read_cache
        player_read_cache.bust_all()
        print("\nCommitted, player read cache busted.")
        return 0
    finally:
        db.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Commit the changes.")
    parser.add_argument(
        "--overwrite", action="store_true",
        help="Replace existing values. Default only fills in NULLs.",
    )
    parser.add_argument(
        "--no-cache", action="store_true",
        help="Refetch the feed instead of reusing the 1h cached copy.",
    )
    return asyncio.run(run(parser.parse_args()))


if __name__ == "__main__":
    raise SystemExit(main())

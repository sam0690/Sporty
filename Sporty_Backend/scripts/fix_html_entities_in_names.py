"""Un-escape HTML entities that an ingestion path baked into stored names.

Some names were written through a layer that HTML-escaped them, so the entity
text is now the literal stored value:

    players.name        "D. O&apos;Shea"
    real_teams.name     "Brighton &amp; Hove Albion"
    players.real_team   "Brighton &amp; Hove Albion"   (denormalised copy)

Beyond displaying wrong, this breaks name matching: an escaped apostrophe
splits into an extra token, which is why the O'Riley / O'Brien / O'Reilly /
O'Nien duplicates in scripts/merge_duplicate_players.py had to be listed by
hand instead of being found automatically.

`players.real_team` is a denormalised copy of `real_teams.name` (the FK
`real_team_id` is authoritative), so both are rewritten together to keep them
consistent.

Renames are checked against uq_players_identity (sport, folded name,
real_team_id) and the real_teams (sport_id, name) unique constraint before
being applied — a rename that would collide is reported and skipped, since
that means a duplicate needs merging first.

Run manually (verify with the default dry-run first):
    venv/bin/python scripts/fix_html_entities_in_names.py
    venv/bin/python scripts/fix_html_entities_in_names.py --apply
"""
from __future__ import annotations

import argparse
import html
import re
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import app.main  # noqa: F401 — registers all model modules so relationships resolve

from app.database import SessionLocal
from app.player.models import Player, RealTeam
from app.services.sync.name_matching import normalize

ENTITY = re.compile(r"&[a-zA-Z]+;|&#[0-9]+;")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Commit the changes.")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        team_renames = 0
        player_renames = 0
        denorm_updates = 0
        skipped: list[str] = []

        teams = [t for t in db.query(RealTeam).all() if ENTITY.search(t.name or "")]
        existing_team_names = {
            (t.sport_id, t.name) for t in db.query(RealTeam).all()
        }
        for team in teams:
            clean = html.unescape(team.name)
            if (team.sport_id, clean) in existing_team_names:
                skipped.append(f"team {team.name!r} -> {clean!r} (name already taken)")
                continue
            print(f"  team   {team.name!r} -> {clean!r}")
            team.name = clean
            team_renames += 1

            # Keep the denormalised copy on Player in step with the FK.
            affected = (
                db.query(Player).filter(Player.real_team_id == team.id).all()
            )
            for player in affected:
                if player.real_team != clean:
                    player.real_team = clean
                    denorm_updates += 1

        players = [p for p in db.query(Player).all() if ENTITY.search(p.name or "")]
        # Mirrors uq_players_identity so a rename cannot abort the transaction.
        occupied = {
            (p.sport_id, normalize(p.name), p.real_team_id): p.id
            for p in db.query(Player).all()
        }
        for player in players:
            clean = html.unescape(player.name)
            key = (player.sport_id, normalize(clean), player.real_team_id)
            occupant = occupied.get(key)
            if occupant is not None and occupant != player.id:
                skipped.append(
                    f"player {player.name!r} -> {clean!r} "
                    "(another player at that club already folds to this name — merge first)"
                )
                continue
            print(f"  player {player.name!r} -> {clean!r}")
            player.name = clean
            player_renames += 1

        print(
            f"\nteam renames: {team_renames}   player renames: {player_renames}   "
            f"denormalised real_team updates: {denorm_updates}"
        )
        if skipped:
            print(f"\nSkipped ({len(skipped)}):")
            for line in skipped:
                print(f"  {line}")

        if not (team_renames or player_renames or denorm_updates):
            print("Nothing to fix.")
            return 0

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

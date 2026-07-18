"""One-time backfill for basketball player positions.

Every basketball Player row was seeded from basketball/nba_player_stats_2026.csv
(app/ingestion/dataset_importer.py), a stats-leaderboard export with no
position column — the importer hardcodes position="UNK" for all 582 rows.
That's a live bug: the frontend's position filter (2026-07-18) now queries
Player.position IN {PG,SG,SF,PF,C} for basketball and gets zero rows back.

This fills real positions in from nba_api's CommonTeamRoster, joined by the
NBA person ID already stored in Player.external_api_id ("nba:<id>") — no
name-matching needed. Doesn't touch app/services/sync/player_sync.py's
sync_basketball_players (it deletes-and-recreates the basketball catalog,
which would orphan every FK into these Player rows — TeamPlayer, DraftPick,
etc.); this script only UPDATEs the position column in place.

Confirmed safe to run: basketball has zero LineupSlot rows in prod (checked
2026-07-18) and empty position_minimums in sportConfigs.py, so no squad/
lineup validation depends on the current "UNK" value.

nba_api's roster POSITION is coarse (G/F/C, sometimes hyphenated combos),
not the 5-way PG/SG/SF/PF/C split the app uses — see map_nba_position()'s
ponytail note for the heuristic and its ceiling.

Run manually (verify with --dry-run first):
    venv/bin/python scripts/backfill_basketball_positions.py --dry-run
    venv/bin/python scripts/backfill_basketball_positions.py
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import app.main  # noqa: F401 — registers all model modules so relationships resolve

from app.database import SessionLocal
from app.league.models import Sport
from app.player.models import Player
from app.services.sync.player_sync import _nba_season_string

# ponytail: nba_api's CommonTeamRoster only gives coarse G/F/C (sometimes
# hyphenated) — not a real PG/SG/SF/PF/C split, which stats.nba.com doesn't
# track at all. This picks one reasonable code per coarse value; upgrade to
# a real per-player primary-position source (e.g. a fantasy-specific API)
# if lineup UX ever needs the split to be accurate rather than plausible.
POSITION_MAP = {
    "G": "PG",
    "G-F": "SG",
    "F-G": "SG",
    "F": "SF",
    "F-C": "PF",
    "C-F": "PF",
    "C": "C",
}


def resolve_position(external_api_id: str, nba_positions: dict[str, str]) -> str | None:
    """external_api_id is "nba:<id>"; returns a mapped PG/SG/SF/PF/C code,
    or None if the player isn't on a current roster or has an unmapped code."""
    nba_id = external_api_id.split(":", 1)[1]
    raw_position = nba_positions.get(nba_id)
    if not raw_position:
        return None
    return POSITION_MAP.get(raw_position)


def fetch_nba_positions(season: str) -> dict[str, str]:
    """NBA person-id (str) -> coarse position, via one CommonTeamRoster call
    per team (~30 calls) instead of one CommonPlayerInfo call per player."""
    from nba_api.stats.endpoints import commonteamroster
    from nba_api.stats.static import teams as nba_teams

    positions: dict[str, str] = {}
    for team in nba_teams.get_teams():
        roster = commonteamroster.CommonTeamRoster(team_id=str(team["id"]), season=season)
        for row in roster.get_data_frames()[0].to_dict("records"):
            player_id = row.get("PLAYER_ID")
            raw_position = str(row.get("POSITION", "") or "").strip()
            if player_id and raw_position:
                positions[str(player_id)] = raw_position
        time.sleep(0.3)  # be polite to the unofficial API
    return positions


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Compute and print the fix but roll back instead of committing.",
    )
    parser.add_argument(
        "--season", default=None,
        help="NBA season string e.g. '2025-26' (defaults to the current season).",
    )
    args = parser.parse_args()

    season = _nba_season_string(args.season)

    db = SessionLocal()
    try:
        sport = db.query(Sport).filter(Sport.name == "basketball").first()
        if sport is None:
            print("No 'basketball' sport row found, nothing to backfill")
            return 0

        players = (
            db.query(Player)
            .filter(Player.sport_id == sport.id, Player.external_api_id.like("nba:%"))
            .all()
        )
        if not players:
            print("No nba:-sourced basketball players found, nothing to do.")
            return 0

        print(f"Fetching rosters for season {season}...")
        nba_positions = fetch_nba_positions(season)
        print(f"Got positions for {len(nba_positions)} NBA players.")

        updated: list[tuple[str, str, str]] = []
        unmatched: list[str] = []
        for player in players:
            mapped = resolve_position(player.external_api_id, nba_positions)
            if not mapped:
                unmatched.append(player.name)
                continue
            if mapped != player.position:
                updated.append((player.name, player.position, mapped))
                player.position = mapped

        print(f"\n{'player':<28}{'old':>6}{'new':>6}")
        for name, old, new in updated[:20]:
            print(f"{name:<28}{old:>6}{new:>6}")
        if len(updated) > 20:
            print(f"... and {len(updated) - 20} more")

        print(f"\nPlayers updated: {len(updated)}")
        print(f"Players left unmatched (still UNK, not in current rosters): {len(unmatched)}")
        if unmatched[:10]:
            print("  e.g.:", ", ".join(unmatched[:10]))

        if args.dry_run:
            db.rollback()
            print("\n--dry-run set: rolled back, no changes committed.")
        else:
            db.commit()
            print("\nCommitted.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())

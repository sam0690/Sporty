"""One-time backfill correcting the basketball season-totals-vs-per-game bug.

`basketball/*.csv` holds season-aggregate stats (PTS/AST/REB/STL/BLK/MIN
summed across GP games played), but `_import_basketball_csv` originally
wrote each row into a single PlayerGameweekStat/NBAStat row as if it were
one game's box score — inflating fantasy_points (and therefore repriced
cost) by roughly GP times. `app/ingestion/dataset_importer.py` has since
been fixed to divide by GP at import time; this script corrects the rows
that were already seeded before that fix.

`Player.cost` is recomputed from the CSV's season totals (the cost
formula's divisors are calibrated for season-total scale, that part was
never wrong) rather than by replaying repricing history, since that
history was computed off the bad per-window fantasy_points and isn't
recoverable/meaningful. Existing `PlayerPriceHistory` rows are left in
place as a historical record — they simply predate this fix.

Run manually (verify with --dry-run first):
    venv/bin/python scripts/backfill_basketball_stat_scale.py --dry-run
    venv/bin/python scripts/backfill_basketball_stat_scale.py
"""
from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import app.main  # noqa: F401 — registers all model modules so relationships resolve

from app.database import SessionLocal
from app.ingestion.dataset_importer import DatasetImporter
from app.league.models import Sport
from app.player.models import Player, PlayerGameweekStat
from app.player.models_nba import NBAStat
from app.services.scoring.player_scoring import NBA_ACTIONS, compute_nba_fantasy_points
from app.services.scoring.rules import resolve_effective_rules

CSV_PATH = project_root.parent / "basketball" / "nba_player_stats_2026.csv"


def _cap_minutes(minutes: int) -> int:
    return max(0, min(minutes, 120))


def _load_csv_by_player_id() -> dict[str, dict[str, str]]:
    with CSV_PATH.open(newline="", encoding="utf-8") as f:
        return {row["PLAYER_ID"]: row for row in csv.DictReader(f)}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Compute and print the fix but roll back instead of committing.",
    )
    args = parser.parse_args()

    if not CSV_PATH.exists():
        print(f"Source CSV not found at {CSV_PATH}, aborting")
        return 1

    csv_by_id = _load_csv_by_player_id()
    db = SessionLocal()
    importer = DatasetImporter(db)

    try:
        sport = db.query(Sport).filter(Sport.name == "basketball").first()
        if sport is None:
            print("No 'basketball' sport row found, nothing to backfill")
            return 0

        rules = resolve_effective_rules(db, sport_id=sport.id, actions=NBA_ACTIONS)

        players = (
            db.query(Player)
            .filter(Player.sport_id == sport.id, Player.external_api_id.like("nba:%"))
            .all()
        )

        updated_players = 0
        updated_stat_rows = 0
        unmatched: list[str] = []
        summary_rows: list[tuple[str, str, str, str, str]] = []

        for player in players:
            csv_player_id = player.external_api_id.split(":", 1)[1]
            row = csv_by_id.get(csv_player_id)
            if row is None:
                unmatched.append(player.name)
                continue

            games_played = int(float(row["GP"] or 0))
            if games_played <= 0:
                unmatched.append(player.name)
                continue

            season_points = int(float(row["PTS"] or 0))
            season_assists = int(float(row["AST"] or 0))
            season_rebounds = int(float(row["REB"] or 0))
            season_steals = int(float(row["STL"] or 0))
            season_blocks = int(float(row["BLK"] or 0))
            season_minutes = int(float(row["MIN"] or 0))

            points = season_points // games_played
            assists = season_assists // games_played
            rebounds = season_rebounds // games_played
            steals = season_steals // games_played
            blocks = season_blocks // games_played
            minutes_played = _cap_minutes(season_minutes // games_played)

            new_cost = importer._basketball_cost(season_points, season_assists, season_rebounds)
            old_cost = player.cost
            player.cost = new_cost

            stat_rows = (
                db.query(PlayerGameweekStat, NBAStat)
                .join(NBAStat, NBAStat.base_stat_id == PlayerGameweekStat.id)
                .filter(PlayerGameweekStat.player_id == player.id)
                .all()
            )

            old_fantasy_points = None
            new_fantasy_points = None
            for base_stat, nba_stat in stat_rows:
                old_fantasy_points = base_stat.fantasy_points
                nba_stat.points = points
                nba_stat.assists = assists
                nba_stat.rebounds = rebounds
                nba_stat.steals = steals
                nba_stat.blocks = blocks
                base_stat.minutes_played = minutes_played
                new_fantasy_points = compute_nba_fantasy_points(
                    points=points,
                    assists=assists,
                    rebounds=rebounds,
                    steals=steals,
                    blocks=blocks,
                    nba_points_10=rules.points_by_action["nba_points_10"],
                    nba_assists_10=rules.points_by_action["nba_assists_10"],
                    nba_rebound=rules.points_by_action["nba_rebound"],
                    nba_steal=rules.points_by_action["nba_steal"],
                    nba_block=rules.points_by_action["nba_block"],
                )
                base_stat.fantasy_points = new_fantasy_points
                updated_stat_rows += 1

            updated_players += 1
            summary_rows.append((
                player.name,
                f"{old_cost}",
                f"{new_cost}",
                f"{old_fantasy_points}",
                f"{new_fantasy_points}",
            ))

        print(f"{'player':<24}{'old_cost':>10}{'new_cost':>10}{'old_fp':>12}{'new_fp':>12}")
        for name, old_cost, new_cost, old_fp, new_fp in sorted(
            summary_rows, key=lambda r: float(r[3] or 0), reverse=True
        )[:15]:
            print(f"{name:<24}{old_cost:>10}{new_cost:>10}{old_fp:>12}{new_fp:>12}")

        print(
            f"\nPlayers updated: {updated_players}, stat rows updated: {updated_stat_rows}, "
            f"unmatched (no CSV row / GP=0): {len(unmatched)}"
        )
        if unmatched:
            print(f"Unmatched: {', '.join(unmatched[:20])}{'...' if len(unmatched) > 20 else ''}")

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

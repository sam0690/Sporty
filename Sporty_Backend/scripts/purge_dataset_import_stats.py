"""One-time purge of the CSV importer's synthetic season-aggregate stat rows.

`app/ingestion/dataset_importer.py` creates a `dataset-import-<label>` Season
per CSV dataset and writes ONE `PlayerGameweekStat` row per player holding
that player's SEASON TOTALS — 120 minutes flat, fantasy_points up to 144.
Those seasons are also dated absurdly far in the future (2098-10-01 and
2099-08-01 in production), which is what made them toxic rather than merely
unused:

  * `recalculate_player_prices` selected windows with a bare
    `ORDER BY end_at DESC LIMIT n`, so the 2099/2100 windows won permanently
    and real gameweeks were never priced. A frozen weighted_points of 27.0
    against a per-gameweek baseline of 6.0 produced a +1.50 step every single
    daily run, walking 165 football players into the 17.0 ceiling.
  * `_player_value_map` in `app/league/auto_pick_service.py` averaged the same
    rows with no window filter at all, so ILP auto-pick ranked players by
    career output instead of current form.

Both call sites now filter to active seasons, so this purge is defence in
depth rather than the fix — but it also removes the rows from every future
consumer that forgets the filter.

Deletes ONLY `player_gameweek_stats` rows belonging to inactive
`dataset-import-*` seasons. The Season and TransferWindow rows are left in
place: the importer recreates them on the next CSV run, and with the active
-season filters they are inert.

Run manually (verify with the default dry-run first):
    venv/bin/python scripts/purge_dataset_import_stats.py
    venv/bin/python scripts/purge_dataset_import_stats.py --apply
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import app.main  # noqa: F401 — registers all model modules so relationships resolve

from app.database import SessionLocal
from app.league.models import Season, TeamPlayer, TransferWindow
from app.player.models import PlayerGameweekStat

# Anything the deletion must not orphan. If any of these reference the
# dataset-import windows then those windows are load-bearing for real fantasy
# data and this script must not run — bail out rather than guess.
GUARD_TABLES = (
    ("team_players", TeamPlayer, TeamPlayer.acquired_window_id),
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Commit the deletion. Without this the script only reports.",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        seasons = (
            db.query(Season)
            .filter(Season.name.like("dataset-import-%"))
            .all()
        )
        if not seasons:
            print("No dataset-import-* seasons found. Nothing to do.")
            return 0

        active = [s for s in seasons if s.is_active]
        if active:
            # An active dataset-import season would be feeding live pricing.
            # That is a different problem than this script solves.
            print("ABORT: dataset-import season(s) marked is_active=True:")
            for season in active:
                print(f"  {season.name} ({season.id})")
            return 1

        season_ids = [s.id for s in seasons]
        window_ids = [
            row[0]
            for row in db.query(TransferWindow.id)
            .filter(TransferWindow.season_id.in_(season_ids))
            .all()
        ]

        print("Seasons targeted:")
        for season in seasons:
            print(
                f"  {season.name} ({season.start_date} → {season.end_date}) "
                f"is_active={season.is_active}"
            )
        print(f"Transfer windows: {len(window_ids)}")

        if not window_ids:
            print("No windows under those seasons. Nothing to do.")
            return 0

        for label, model, column in GUARD_TABLES:
            count = (
                db.query(model).filter(column.in_(window_ids)).count()
            )
            print(f"Guard {label}: {count}")
            if count:
                print(
                    f"ABORT: {count} {label} row(s) reference these windows — "
                    "they hold real fantasy data, not import scaffolding."
                )
                return 1

        stats_query = db.query(PlayerGameweekStat).filter(
            PlayerGameweekStat.transfer_window_id.in_(window_ids)
        )
        total = stats_query.count()
        print(f"player_gameweek_stats rows to delete: {total}")

        if total:
            worst = (
                stats_query.order_by(PlayerGameweekStat.fantasy_points.desc())
                .limit(5)
                .all()
            )
            print("Sample (highest fantasy_points — season totals, not gameweeks):")
            for row in worst:
                print(
                    f"  player={row.player_id} minutes={row.minutes_played} "
                    f"points={row.fantasy_points}"
                )

        if not args.apply:
            print("\nDRY RUN — nothing written. Re-run with --apply to commit.")
            return 0

        deleted = stats_query.delete(synchronize_session=False)
        db.commit()
        print(f"\nDeleted {deleted} player_gameweek_stats row(s).")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())

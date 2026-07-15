"""One-time backfill applying the lowered basketball price cap retroactively.

`app/services/pricing/repricing.py`'s basketball max_cost dropped from 22.0
to 20.0 (2026-07-15) for proportional consistency with the new 100M budget
and football's 17.0 cap. Unlike football, basketball's distribution wasn't
pathologically pinned at its ceiling (only the top 3 players sat there) —
20.0 was chosen to sit just above the natural (non-clamped) max of 20.88 so
it only touches the genuine top tier, not the organic 17-20 gradient.

This script caps existing basketball players whose cost is already above
the new ceiling down to it, and writes a PlayerPriceHistory row per player
so the drop is auditable the same way organic repricing is
(transfer_window_id left null, algorithm_version="cap_backfill_2026_07" —
this wasn't derived from a window's stats, just a policy-ceiling
correction).

`FantasyTeam.current_budget` is untouched: it's built from
`TeamPlayer.cost_at_acquisition` (the frozen purchase price), not live
`Player.cost`, so this never changes anyone's spendable budget or transfer
math — only the live cost shown on player cards/market listings.

Run manually (verify with --dry-run first):
    venv/bin/python scripts/backfill_basketball_price_cap.py --dry-run
    venv/bin/python scripts/backfill_basketball_price_cap.py
"""
from __future__ import annotations

import argparse
import sys
from decimal import Decimal
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import app.main  # noqa: F401 — registers all model modules so relationships resolve

from app.database import SessionLocal
from app.league.models import Sport
from app.player.models import Player, PlayerPriceHistory
from app.services.pricing.repricing import SPORT_POLICIES

ALGORITHM_VERSION = "cap_backfill_2026_07"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Compute and print the fix but roll back instead of committing.",
    )
    args = parser.parse_args()

    new_cap = SPORT_POLICIES["basketball"].max_cost

    db = SessionLocal()
    try:
        sport = db.query(Sport).filter(Sport.name == "basketball").first()
        if sport is None:
            print("No 'basketball' sport row found, nothing to backfill")
            return 0

        players = (
            db.query(Player)
            .filter(Player.sport_id == sport.id, Player.cost > new_cap)
            .order_by(Player.cost.desc())
            .all()
        )

        if not players:
            print(f"No basketball players above the {new_cap} cap, nothing to do.")
            return 0

        history_rows: list[PlayerPriceHistory] = []
        summary_rows: list[tuple[str, Decimal]] = []
        for player in players:
            old_cost = player.cost
            summary_rows.append((player.name, old_cost))
            history_rows.append(
                PlayerPriceHistory(
                    player_id=player.id,
                    transfer_window_id=None,
                    old_cost=old_cost,
                    new_cost=new_cap,
                    delta=new_cap - old_cost,
                    weighted_points=None,
                    algorithm_version=ALGORITHM_VERSION,
                )
            )
            player.cost = new_cap

        db.add_all(history_rows)

        print(f"{'player':<28}{'old_cost':>10}{'new_cost':>10}")
        for name, old_cost in summary_rows[:20]:
            print(f"{name:<28}{str(old_cost):>10}{str(new_cap):>10}")
        if len(summary_rows) > 20:
            print(f"... and {len(summary_rows) - 20} more")

        print(f"\nPlayers capped: {len(players)} (cost > {new_cap} -> {new_cap})")

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

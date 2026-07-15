"""One-time migration moving existing leagues from budget_per_team=103 to
100, following the "floor at 0, absorb shortfall" approach (Option C from
the 2026-07-15 budget review — see conversation/PR notes, no code doc for
that discussion).

Every existing budget-mode team has already spent close to their full
103M — a flat rebase (new_budget - total_spent) would push most of them
negative for a policy change they had no part in, and would likely route
their next unrelated transfer through the budget-overage-pay-with-points
flow. Instead, for each team on the old 103 baseline:

    total_spent        = 103 - team.current_budget   (unchanged cost basis;
                                                        no player is sold or
                                                        re-costed)
    team.current_budget = max(0, 100 - total_spent)
    team.starting_budget = 100

`starting_budget` is updated too, not just `current_budget` — otherwise an
archived team whose `starting_budget` still says 103 gets hard-blocked from
ever rejoining once `league.budget_per_team` becomes 100 (see the
mismatch guard in league_service.py's membership-reactivation path).

No TeamPlayer/roster/cost_at_acquisition rows are touched — nobody has to
sell anyone, this is a ledger-only correction.

Scoped to leagues currently at the exact old default (budget_per_team ==
103.00), matching the leagues actually affected — not "all leagues", so a
league an admin deliberately set to 103 after this migration wouldn't be
silently re-migrated.

Run manually (verify with --dry-run first):
    venv/bin/python scripts/migrate_league_budget_100.py --dry-run
    venv/bin/python scripts/migrate_league_budget_100.py
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
from app.league.models import FantasyTeam, League

OLD_BUDGET = Decimal("103.00")
NEW_BUDGET = Decimal("100.00")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Compute and print the fix but roll back instead of committing.",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        leagues = db.query(League).filter(League.budget_per_team == OLD_BUDGET).all()
        if not leagues:
            print(f"No leagues at budget_per_team={OLD_BUDGET}, nothing to do.")
            return 0

        summary_rows: list[tuple[str, str, Decimal, Decimal, Decimal]] = []

        for league in leagues:
            teams = (
                db.query(FantasyTeam).filter(FantasyTeam.league_id == league.id).all()
            )
            for team in teams:
                total_spent = OLD_BUDGET - team.current_budget
                old_current = team.current_budget
                new_current = max(Decimal("0.00"), NEW_BUDGET - total_spent)

                summary_rows.append(
                    (league.name, team.name, old_current, new_current, total_spent)
                )

                team.current_budget = new_current
                team.starting_budget = NEW_BUDGET

            league.budget_per_team = NEW_BUDGET

        print(f"{'league':<16}{'team':<24}{'old_budget':>11}{'new_budget':>11}{'total_spent':>13}")
        for league_name, team_name, old_current, new_current, total_spent in summary_rows:
            print(
                f"{league_name:<16}{team_name:<24}{str(old_current):>11}"
                f"{str(new_current):>11}{str(total_spent):>13}"
            )

        floored = sum(1 for *_rest, total_spent in summary_rows if NEW_BUDGET - total_spent < 0)
        print(
            f"\nLeagues migrated: {len(leagues)}, teams migrated: {len(summary_rows)}, "
            f"floored at 0 (shortfall absorbed): {floored}"
        )

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

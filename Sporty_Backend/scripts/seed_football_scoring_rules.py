"""Seed the position-aware football scoring rule set.

Defines the whole football scoring model as DB rows (the engine reads these —
app/services/scoring/football_engine.py). Idempotent: upserts on
(sport_id, action, COALESCE(position,'')) and retires the 4 legacy
football_goal/football_assist/... rows the old bulk-SQL scorer used.

Run from Sporty_Backend/:
    PYTHONPATH=. venv/bin/python scripts/seed_football_scoring_rules.py [--apply]
Dry run by default (prints the resulting rule set, rolls back).
"""
import sys
from pathlib import Path

# Run as `python scripts/seed_football_scoring_rules.py` (Docker boot) puts
# scripts/ on sys.path, not the project root — add it so `import app` resolves.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import app.main  # noqa: E402,F401  (register mappers)
from app.database import SessionLocal  # noqa: E402
from app.league.models import Sport
from app.scoring.models import DefaultScoringRule
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert

APPLY = "--apply" in sys.argv

# (action, position, mode, param, points, description)
RULES = [
    ("appearance",      None,  "threshold", 1,   1,  "Played at least 1 minute (+1)"),
    ("appearance_full", None,  "threshold", 60,  1,  "Played 60+ minutes (+1 more)"),
    ("goal",            "GKP", "per_unit",  None, 6,  "Goal — goalkeeper (+6)"),
    ("goal",            "DEF", "per_unit",  None, 6,  "Goal — defender (+6)"),
    ("goal",            "MID", "per_unit",  None, 5,  "Goal — midfielder (+5)"),
    ("goal",            "FWD", "per_unit",  None, 4,  "Goal — forward (+4)"),
    ("assist",          None,  "per_unit",  None, 3,  "Assist (+3)"),
    ("clean_sheet",     "GKP", "per_unit",  None, 4,  "Clean sheet — goalkeeper (+4)"),
    ("clean_sheet",     "DEF", "per_unit",  None, 4,  "Clean sheet — defender (+4)"),
    ("clean_sheet",     "MID", "per_unit",  None, 1,  "Clean sheet — midfielder (+1)"),
    ("save",            "GKP", "per_n",     3,    1,  "Every 3 saves (+1)"),
    ("penalty_save",    "GKP", "per_unit",  None, 5,  "Penalty saved (+5)"),
    ("penalty_miss",    None,  "per_unit",  None, -2, "Penalty missed (-2)"),
    ("own_goal",        None,  "per_unit",  None, -2, "Own goal (-2)"),
    ("conceded",        "GKP", "per_n",     2,    -1, "Every 2 goals conceded (-1) — goalkeeper"),
    ("conceded",        "DEF", "per_n",     2,    -1, "Every 2 goals conceded (-1) — defender"),
    ("yellow_card",     None,  "per_unit",  None, -1, "Yellow card (-1)"),
    ("red_card",        None,  "per_unit",  None, -3, "Red card (-3)"),
    # Defensive contribution = tackles+interceptions+blocks+clearances (FPL 24/25).
    ("defensive_contribution", "DEF", "threshold", 10, 2, "10+ tackles/interceptions/blocks (+2) — defender"),
    ("defensive_contribution", "MID", "threshold", 12, 2, "12+ defensive actions (+2) — midfielder"),
    ("defensive_contribution", "FWD", "threshold", 12, 2, "12+ defensive actions (+2) — forward"),
    # Advanced attacking — rules seeded now; score 0 until the FT-sheet parser
    # captures key_passes / shots_on_target (Phase 3).
    ("key_pass",        "MID", "per_n",     3,    1,  "Every 3 key passes (+1) — midfielder"),
    ("key_pass",        "FWD", "per_n",     4,    1,  "Every 4 key passes (+1) — forward"),
    ("shot_on_target",  "FWD", "per_n",     3,    1,  "Every 3 shots on target (+1) — forward"),
]

LEGACY = ["football_goal", "football_assist", "football_yellow_card", "football_red_card"]


def main():
    db = SessionLocal()
    fb = db.query(Sport).filter(Sport.name == "football").first()
    if not fb:
        print("ABORT: football sport not found")
        sys.exit(1)

    # Retire the legacy flat rules the new engine no longer reads.
    removed = (
        db.query(DefaultScoringRule)
        .filter(DefaultScoringRule.sport_id == fb.id, DefaultScoringRule.action.in_(LEGACY))
        .delete(synchronize_session=False)
    )

    tbl = DefaultScoringRule.__table__
    for action, position, mode, param, points, desc in RULES:
        stmt = insert(tbl).values(
            sport_id=fb.id, action=action, position=position, mode=mode,
            param=param, points=points, description=desc,
        ).on_conflict_do_update(
            index_elements=[tbl.c.sport_id, tbl.c.action, text("COALESCE(position, '')")],
            set_={"points": points, "mode": mode, "param": param, "description": desc},
        )
        db.execute(stmt)

    total = db.query(DefaultScoringRule).filter(DefaultScoringRule.sport_id == fb.id).count()
    print(f"{'APPLIED' if APPLY else 'DRY RUN'}: retired {removed} legacy rows, upserted {len(RULES)} rules; "
          f"football now has {total} rules")
    for r in (db.query(DefaultScoringRule)
              .filter(DefaultScoringRule.sport_id == fb.id)
              .order_by(DefaultScoringRule.action, DefaultScoringRule.position).all()):
        print(f"  {r.action:24} {str(r.position or 'ALL'):4} {r.mode:9} param={str(r.param):5} pts={r.points}")

    if APPLY:
        db.commit(); print("*** COMMITTED ***")
    else:
        db.rollback(); print("*** ROLLED BACK (pass --apply) ***")
    db.close()


if __name__ == "__main__":
    main()

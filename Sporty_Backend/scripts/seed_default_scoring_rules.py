"""Seed default scoring rules (Phase 7).

Why:
- The scoring engine resolves points from DB defaults + league overrides.
- Football has fallback defaults in code, but cricket is fully DB-driven.

This script is idempotent:
- Uses ON CONFLICT (sport_id, action) DO UPDATE.

Usage:
  python scripts/seed_default_scoring_rules.py

Requires:
- DATABASE_URL in environment or .env
"""

from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import sessionmaker

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

load_dotenv()

# Import models to register mappers
from app.league.models import Sport  # noqa: E402
from app.scoring.models import DefaultScoringRule  # noqa: E402


DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("❌ DATABASE_URL not found in environment variables")
    raise SystemExit(1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)


def _upsert_rules(db, *, sport_id: uuid.UUID, rules: list[dict]) -> int:
    table = DefaultScoringRule.__table__
    values = [
        {
            "id": uuid.uuid4(),
            "sport_id": sport_id,
            "action": r["action"],
            "points": r["points"],
            "description": r["description"],
        }
        for r in rules
    ]

    stmt = insert(table).values(values)
    stmt = stmt.on_conflict_do_update(
        index_elements=[table.c.sport_id, table.c.action],
        set_={
            "points": stmt.excluded.points,
            "description": stmt.excluded.description,
        },
    )
    result = db.execute(stmt)
    return int(result.rowcount or 0)


def seed_default_scoring_rules() -> None:
    db = SessionLocal()
    try:
        football = db.query(Sport).filter(Sport.name == "football").first()
        basketball = db.query(Sport).filter(Sport.name == "basketball").first()
        cricket = db.query(Sport).filter(Sport.name == "cricket").first()

        if not football:
            print("⚠️  Sport 'football' not found. Run scripts/create_sports.py first.")
        if not basketball:
            print("⚠️  Sport 'basketball' not found. Run scripts/create_sports.py first.")
        if not cricket:
            print("⚠️  Sport 'cricket' not found. Run scripts/create_sports.py first.")

        total = 0

        if football:
            football_rules = [
                {"action": "football_goal", "points": 5, "description": "Goal scored"},
                {"action": "football_assist", "points": 3, "description": "Assist"},
                {"action": "football_yellow_card", "points": -1, "description": "Yellow card"},
                {"action": "football_red_card", "points": -2, "description": "Red card"},
            ]
            total += _upsert_rules(db, sport_id=football.id, rules=football_rules)
            print("✅ Seeded football default scoring rules")

        if basketball:
            basketball_rules = [
                {"action": "nba_points_10", "points": 3, "description": "Every 10 points scored (fractional)"},
                {"action": "nba_assists_10", "points": 2, "description": "Every 10 assists (fractional)"},
                {"action": "nba_rebound", "points": 1, "description": "Rebound"},
                {"action": "nba_steal", "points": 2, "description": "Steal"},
                {"action": "nba_block", "points": 2, "description": "Block"},
            ]
            total += _upsert_rules(db, sport_id=basketball.id, rules=basketball_rules)
            print("✅ Seeded basketball (NBA) default scoring rules")

        if cricket:
            # Baseline defaults (tweak as desired; leagues can override per action)
            cricket_rules = [
                {"action": "cricket_run", "points": 1, "description": "Run scored"},
                {"action": "cricket_wicket", "points": 25, "description": "Wicket taken"},
                {"action": "cricket_catch", "points": 8, "description": "Catch"},
                {"action": "cricket_run_out", "points": 12, "description": "Run out"},
                {"action": "cricket_maiden", "points": 12, "description": "Maiden over"},
            ]
            total += _upsert_rules(db, sport_id=cricket.id, rules=cricket_rules)
            print("✅ Seeded cricket default scoring rules")

        db.commit()
        print(f"\n✅ Done. Upserted/updated ~{total} rows.")

    except Exception as e:
        db.rollback()
        print(f"❌ Error seeding rules: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_default_scoring_rules()

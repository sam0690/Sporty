"""
Create initial sports in database.

This script creates the three main sports (football, basketball, cricket)
in the database if they don't already exist.

Usage:
    python scripts/create_sports.py
"""

import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

load_dotenv()

from app.league.models import Sport

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("❌ DATABASE_URL not found in environment variables")
    sys.exit(1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)


def create_sports():
    """Create initial sports if they don't exist."""
    db = SessionLocal()

    try:
        sports_data = [
            {"name": "football", "display_name": "Football"},
            {"name": "basketball", "display_name": "Basketball"},
            {"name": "cricket", "display_name": "Cricket"},
        ]

        for sport_data in sports_data:
            existing = (
                db.query(Sport).filter(Sport.name == sport_data["name"]).first()
            )

            if existing:
                print(f"  ℹ️  Sport '{sport_data['display_name']}' already exists")
            else:
                sport = Sport(
                    name=sport_data["name"],
                    display_name=sport_data["display_name"],
                    is_active=True,
                )
                db.add(sport)
                print(f"  ✅ Created sport: {sport_data['display_name']}")

        db.commit()
        print("\n✅ Sports setup complete!")

    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    print("🏃 Creating sports...\n")
    create_sports()

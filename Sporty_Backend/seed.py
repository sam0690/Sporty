from __future__ import annotations

import argparse
import asyncio
import sys

from app.database import SessionLocal
from app.ingestion.adapters import SPORT_ADAPTERS
from app.ingestion.orchestrator import IngestionOrchestrator


def main() -> int:
    parser = argparse.ArgumentParser(description="Ingest sport catalog data")
    parser.add_argument("sport", choices=sorted(SPORT_ADAPTERS.keys()), help="Sport to ingest")
    args = parser.parse_args()

    db = SessionLocal()
    orchestrator = IngestionOrchestrator(db)

    try:
        result = asyncio.run(orchestrator.ingest(args.sport))
        print(
            f"Deleted {result.deleted_players} players and {result.deleted_teams} teams; "
            f"inserted {result.inserted_teams} teams and {result.inserted_players} players for {result.sport}."
        )
        return 0
    except Exception as exc:
        print(f"Ingestion failed for {args.sport}: {exc}")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())

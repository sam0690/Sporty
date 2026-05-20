from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

from app.database import SessionLocal
from app.ingestion.adapters import SPORT_ADAPTERS
from app.ingestion.dataset_importer import import_attached_datasets
from app.ingestion.orchestrator import IngestionOrchestrator


def main() -> int:
    parser = argparse.ArgumentParser(description="Ingest sport catalog data")
    parser.add_argument(
        "sport",
        choices=sorted([*SPORT_ADAPTERS.keys(), "datasets"]),
        help="Sport to ingest, or 'datasets' to import attached files",
    )
    args = parser.parse_args()

    db = SessionLocal()
    orchestrator = IngestionOrchestrator(db)
    repo_root = Path(__file__).resolve().parent.parent

    try:
        if args.sport == "datasets":
            report = import_attached_datasets(db, repo_root=repo_root)
            print(f"Imported {report.imported_rows} rows from {len(report.files)} files.")
            for file_report in report.files:
                print(
                    f"- {Path(file_report.path).name}: sport={file_report.sport}, format={file_report.format}, "
                    f"rows={file_report.rows_seen}, imported={file_report.rows_imported}, skipped={file_report.rows_skipped}"
                )
                if file_report.unmapped_columns:
                    sample = ", ".join(file_report.unmapped_columns[:10])
                    suffix = "..." if len(file_report.unmapped_columns) > 10 else ""
                    print(f"  unmapped columns: {sample}{suffix}")
                for warning in file_report.warnings[:5]:
                    print(f"  warning: {warning}")
                for error in file_report.errors:
                    print(f"  error: {error}")
            return 0

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

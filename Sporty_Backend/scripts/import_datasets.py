"""Import attached dataset files into the database.

Usage:
  python scripts/import_datasets.py

This scans the attached dataset folders (EPL/ and basketball/) beneath the
repository root, detects supported formats, and upserts the data into the
existing sports/player/stat tables.
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from app.core.config import settings
from app.ingestion.dataset_importer import import_attached_datasets


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    engine = create_engine(settings.DATABASE_URL)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    repo_root = project_root.parent

    try:
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
    except Exception as exc:
        print(f"Dataset import failed: {exc}")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
"""Download every national flag we need and serve it from our own R2 bucket.

Flags are fetched once from flagcdn.com (public domain, SVG) and uploaded to
R2 under `flags/<code>.svg`, so the app never hot-links a third party in the
player profile — same policy already applied to player photos and club crests.

One object per country, ~100 total, rather than a URL column on Player: the
pool has ~1780 players repeating ~96 distinct nationalities, and the flag URL
is fully derivable from the nationality string
(app/services/sync/nationalities.py::flag_url).

Codes come from NATIONALITY_TO_ISO. Most are ISO 3166-1 alpha-2; the UK home
nations use flagcdn's GB subdivision codes (gb-eng, gb-sct, gb-wls, gb-nir)
because they field their own football teams, and Kosovo uses "xk".

Run manually (verify with the default dry-run first):
    venv/bin/python scripts/upload_country_flags.py
    venv/bin/python scripts/upload_country_flags.py --apply
    venv/bin/python scripts/upload_country_flags.py --apply --only-used
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import httpx

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import app.main  # noqa: F401 — registers all model modules so relationships resolve

from app.core.config import settings
from app.database import SessionLocal
from app.player.models import Player
from app.services.storage_service import upload_country_flag
from app.services.sync.nationalities import NATIONALITY_TO_ISO, iso_code

FLAGCDN_SVG = "https://flagcdn.com/{code}.svg"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Upload to R2.")
    parser.add_argument(
        "--only-used",
        action="store_true",
        help="Only flags for nationalities actually present in the player pool.",
    )
    args = parser.parse_args()

    if args.apply and not settings.r2_is_configured():
        print("R2 is not configured (R2_* settings missing).")
        return 1

    codes = sorted(set(NATIONALITY_TO_ISO.values()))

    if args.only_used:
        db = SessionLocal()
        try:
            used = {
                iso_code(row[0])
                for row in db.query(Player.nationality).distinct()
                if row[0]
            }
        finally:
            db.close()
        codes = sorted(c for c in codes if c in used)

    print(f"flags to fetch: {len(codes)}")
    if not args.apply:
        print("  " + ", ".join(codes))
        print("\nDRY RUN — nothing downloaded or uploaded. Re-run with --apply.")
        return 0

    uploaded = 0
    failed: list[str] = []
    with httpx.Client(timeout=30, follow_redirects=True) as client:
        for code in codes:
            try:
                response = client.get(FLAGCDN_SVG.format(code=code))
                response.raise_for_status()
                if not response.content.lstrip().startswith((b"<svg", b"<?xml")):
                    raise RuntimeError("response was not SVG")
                url = upload_country_flag(code, response.content)
                uploaded += 1
                print(f"  {code:<7} {len(response.content):>7} bytes  {url}")
            except Exception as exc:  # noqa: BLE001 — report and continue
                failed.append(f"{code}: {exc}")

    print(f"\nuploaded: {uploaded}")
    if failed:
        print(f"failed ({len(failed)}):")
        for line in failed:
            print(f"  {line}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

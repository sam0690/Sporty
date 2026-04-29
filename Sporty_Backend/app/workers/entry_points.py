from __future__ import annotations

import asyncio
import sys

from app.consumers.normalizer import run as run_normalizer
from app.consumers.notifications import run as run_notifications
from app.consumers.points_engine import run as run_points_engine


def main() -> None:
    target = (sys.argv[1] if len(sys.argv) > 1 else "").strip().lower()

    if target == "points-engine":
        asyncio.run(run_points_engine())
        return

    if target == "normalizer":
        asyncio.run(run_normalizer())
        return

    if target == "notifications":
        asyncio.run(run_notifications())
        return

    raise SystemExit("Usage: python -m app.workers.entry_points [points-engine|normalizer|notifications]")


if __name__ == "__main__":
    main()

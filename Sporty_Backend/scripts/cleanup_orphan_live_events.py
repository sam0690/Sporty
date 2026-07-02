"""Clean up orphaned live_events — events whose player_id resolves to no Player.

Old demo/replay matches were pushed with synthetic player UUIDs that were never
inserted as real players, so the match detail page renders raw UUIDs in the
Match Events feed and Top Performers. Those events carry no recoverable name
(the ids match neither players.id nor players.external_api_id), so we remove them.

Resolution mirrors the runtime resolver (app/api/routes/match.py::_resolve_players):
an event is ORPHANED when player_id is non-empty AND matches no player by
lower(id) or external_api_id.

Safety:
  - Dry run by default: prints the affected matches + counts, deletes nothing.
  - --execute performs the delete, AFTER writing a JSON backup of every deleted
    row so it is fully recoverable.

Usage:
  venv/bin/python -m scripts.cleanup_orphan_live_events            # dry run
  venv/bin/python -m scripts.cleanup_orphan_live_events --execute  # delete (+backup)
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import text

from app.database import SessionLocal

# An event is orphaned when it references a player we cannot resolve by id
# (case-insensitive) or external_api_id — i.e. no name will ever render.
_ORPHAN_PREDICATE = """
    le.player_id <> ''
    AND NOT EXISTS (
        SELECT 1 FROM players p
        WHERE lower(p.id::text) = lower(le.player_id)
           OR p.external_api_id = le.player_id
    )
"""


def _summary(db) -> list[dict]:
    rows = db.execute(
        text(
            f"""
            SELECT le.match_id,
                   COALESCE(m.home_team, '?') AS home_team,
                   COALESCE(m.away_team, '?') AS away_team,
                   COUNT(*) FILTER (WHERE le.player_id <> '') AS total_player_events,
                   COUNT(*) FILTER (WHERE {_ORPHAN_PREDICATE}) AS orphan_events
            FROM live_events le
            LEFT JOIN matches m
              ON m.id::text = le.match_id OR m.external_api_id = le.match_id
            GROUP BY le.match_id, m.home_team, m.away_team
            HAVING COUNT(*) FILTER (WHERE {_ORPHAN_PREDICATE}) > 0
            ORDER BY orphan_events DESC
            """
        )
    ).mappings().all()
    return [dict(r) for r in rows]


def _backup(db, path: Path) -> int:
    rows = db.execute(
        text(
            f"""
            SELECT le.id::text AS id, le.match_id, le.event_id, le.sport,
                   le.event_type, le.player_id, le.team_id, le.value,
                   le.meta, le.ts
            FROM live_events le
            WHERE {_ORPHAN_PREDICATE}
            """
        )
    ).mappings().all()
    payload = [
        {**dict(r), "ts": r["ts"].isoformat() if r["ts"] else None}
        for r in rows
    ]
    path.write_text(json.dumps(payload, indent=2, default=str))
    return len(payload)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Delete orphaned live_events (default is a dry run).",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        summary = _summary(db)
        total_orphans = sum(r["orphan_events"] for r in summary)
        fully = [r for r in summary if r["orphan_events"] == r["total_player_events"]]

        print(f"Matches with orphaned events : {len(summary)}")
        print(f"  ...fully unresolved          : {len(fully)}")
        print(f"Orphaned live_events total     : {total_orphans}\n")
        for r in summary:
            tag = "FULL" if r["orphan_events"] == r["total_player_events"] else "part"
            print(
                f"  [{tag}] {r['home_team']} vs {r['away_team']}  "
                f"match_id={r['match_id']}  "
                f"orphans={r['orphan_events']}/{r['total_player_events']}"
            )

        if not args.execute:
            print("\nDry run — nothing deleted. Re-run with --execute to apply.")
            return

        if total_orphans == 0:
            print("\nNothing to delete.")
            return

        backup_dir = Path(__file__).resolve().parent / "backups"
        backup_dir.mkdir(exist_ok=True)
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        backup_path = backup_dir / f"orphan_live_events_{stamp}.json"
        backed_up = _backup(db, backup_path)
        print(f"\nBacked up {backed_up} rows → {backup_path}")

        deleted = db.execute(
            text(f"DELETE FROM live_events le WHERE {_ORPHAN_PREDICATE}")
        ).rowcount
        db.commit()
        print(f"Deleted {deleted} orphaned live_events.")
    finally:
        db.close()


if __name__ == "__main__":
    main()

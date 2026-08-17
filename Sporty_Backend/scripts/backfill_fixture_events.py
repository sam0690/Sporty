"""One-off: book the events an hourly live poll never saw for one fixture.

WHY: API-Football events are only written from the `live=all` poll, and a
finished fixture drops out of that response. With an hourly cadence the stored
event set ends at the last in-play tick — Deportivo La Coruna v Elche (fixture
1570337) stopped at 68' and lost Elche's equaliser, an assist, and four
substitutions. `_finish_match` books the FT stat sheet and never touches
live_events, so nothing backfills that tail.

This fetches /fixtures/events once and books it through the same
upsert_fixture_events() the poll uses, so the rows are byte-identical to what a
well-timed poll would have written. ON CONFLICT DO NOTHING makes it idempotent:
it can only ADD the missing tail, never modify or delete what's there.

Costs 1 API-Football request against the daily budget (the client's own guard
applies — this does not go around it).

Run from Sporty_Backend/:
    PYTHONPATH=. venv/bin/python scripts/backfill_fixture_events.py --fixture 1570337
    PYTHONPATH=. venv/bin/python scripts/backfill_fixture_events.py --fixture 1570337 --apply

Without --apply it prints what it would insert and ROLLS BACK.
"""

import argparse
import asyncio

import app.main  # noqa: F401  — registers every model before SQLAlchemy resolves relationships
from app.database import SessionLocal
from app.external_apis.football_api import FootballAPIClient
from app.league.models import Sport
from app.match.models import Match
from app.models.db.live_event import LiveEvent
from app.player.models import Player
from app.services.sync.football_live_sync import live_key_for, upsert_fixture_events


def _timeline(db, live_key: str) -> list[tuple]:
    """(minute, type, event_id) for every stored event, in display order."""
    rows = (
        db.query(LiveEvent.event_id, LiveEvent.event_type, LiveEvent.meta)
        .filter(LiveEvent.match_id == live_key)
        .all()
    )
    return sorted(
        (((r.meta or {}).get("minute") or 0), r.event_type, r.event_id) for r in rows
    )


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fixture", required=True, help="API-Football fixture id")
    parser.add_argument("--apply", action="store_true", help="commit (default: dry run)")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        sport = db.query(Sport).filter(Sport.name == "football").first()
        if sport is None:
            print("football sport not seeded")
            return 1

        match = (
            db.query(Match)
            .filter(Match.sport_id == sport.id, Match.external_api_id == str(args.fixture))
            .first()
        )
        if match is None:
            print(f"no match row with external_api_id={args.fixture}")
            return 1

        live_key = live_key_for(match)
        print(f"{match.home_team} v {match.away_team}  ({match.status})  live_key={live_key}")

        before = _timeline(db, live_key)
        print(f"stored events before: {len(before)}")

        payload = await FootballAPIClient().get_match_events(fixture_id=int(args.fixture))
        raw_events = payload.get("response", []) or []
        print(f"provider returned:    {len(raw_events)}")

        def resolve_player(api_player_id):
            return (
                db.query(Player)
                .filter(
                    Player.sport_id == sport.id,
                    Player.external_api_id == str(api_player_id),
                )
                .first()
            )

        upsert_fixture_events(
            db,
            live_key=live_key,
            fixture_id=args.fixture,
            raw_events=raw_events,
            resolve_player=resolve_player,
        )
        db.flush()

        added = sorted(set(_timeline(db, live_key)) - set(before))
        print(f"\n{len(added)} new event(s):")
        for minute, event_type, event_id in added:
            print(f"  {minute:>3}'  {event_type:<14} {event_id}")

        if args.apply:
            db.commit()
            print("\ncommitted.")
        else:
            db.rollback()
            print("\nDRY RUN — rolled back. Re-run with --apply to keep these.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))

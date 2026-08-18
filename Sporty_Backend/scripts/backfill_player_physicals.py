"""Backfill player height, weight, date of birth and nationality from API-Football.

WHY THIS ENDPOINT
-----------------
`scripts/backfill_player_bio.py` skipped height and weight on the belief that
API-Football bills one request per player (~1780 requests = ~19 days). That is
true of `players?id=`, but `players?team&season` returns the same profile block
20 players at a time:

    {"player": {"id": 55, "name": "Borja Garcés", "birth": {"date": ...},
                "nationality": "Spain", "height": "183 cm", "weight": "71 kg"}}

Roughly 3 requests per club instead of 25, and because the payload carries the
API-Football player id this matches on `Player.external_api_id` exactly. No
name matching, so none of the Spanish-double-surname misses that leave a
quarter of the La Liga pool without a date of birth.

TWO FREE-PLAN LIMITS SHAPE THIS SCRIPT
--------------------------------------
1. `page` is capped at 3 ("Free plans are limited to a maximum value of 3 for
   the Page parameter"). That rules out the cheaper `players?league&season`
   walk — 53 pages for La Liga, of which we could read three. Per team, three
   pages is 60 players, which covers a season roster with room to spare.
2. Season must be <= 2024 ("Free plans do not have access to this season, try
   from 2022 to 2024"). Height, weight and birthdate are facts about a person,
   not about a season, so a 2024 roster is a perfectly good source for a 2026
   player. The cost is coverage, not accuracy: someone who was at none of our
   58 clubs in 2024 — a youth player or an incoming transfer from elsewhere —
   is not in these pages. Pick those up afterwards with --straggler, which
   spends one request each.

BUDGET AND RESUME
-----------------
~174 requests against a 95/day budget that also holds 25 back for match-day
lineups, so a full sweep takes about three days. Each club's next page lives in
the Redis hash `backfill:physicals:teams` and only advances after that page is
committed, so stopping is always safe and re-running always picks up where it
left off. Hitting the budget floor is a normal end to a run, not an error — the
script says so and exits 0.

Run manually (the dry run reads one page per club so it stays cheap; those
pages cache for 24h, so following it with --apply the same day is free):
    venv/bin/python scripts/backfill_player_physicals.py
    venv/bin/python scripts/backfill_player_physicals.py --apply
    venv/bin/python scripts/backfill_player_physicals.py --apply --straggler
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import date, datetime
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import app.main  # noqa: F401 — registers all model modules so relationships resolve

from app.core.config import settings
from app.core.redis import get_redis
from app.database import SessionLocal
from app.external_apis.football_api import (
    FootballAPIClient,
    FootballQuotaExhausted,
    quota_used_today,
)
from app.league.models import Sport
from app.player.models import Player, RealTeam
from app.services.sync.football_competitions import fantasy_competitions
from app.services.sync.nationalities import iso_code

sys.path.insert(0, str(Path(__file__).parent))
from sync_player_clubs import ClubRef, resolve_team_ids  # noqa: E402

# The only season the free plan serves for this endpoint. See the docstring.
SEASON = 2024

# Free-plan ceiling on the `page` parameter — 60 players per club.
MAX_PAGE = 3

# One hash for the whole sweep: team id -> next page, or DONE.
STATE_KEY = "backfill:physicals:teams"
DONE = "done"

_first_request = True

# The API caps 10 requests/minute; the client raises rather than backing off.
REQUEST_INTERVAL_SECONDS = 6.5

# Commit (and advance the cursor) this often in --straggler mode, so an
# interrupted run keeps its progress the way the league sweep does per page.
COMMIT_EVERY = 10

FIELDS = ("height", "weight", "date_of_birth", "nationality")


async def paced(coro_factory):
    """Sleep before every request but the first.

    Pacing only *between* pages of one club leaves back-to-back calls at each
    club boundary, which is enough to trip the 10 requests/minute cap — the
    client raises FootballQuotaExhausted on a 429, so it reads exactly like a
    spent daily budget and the sweep stops early for no reason.
    """
    global _first_request
    if not _first_request:
        await asyncio.sleep(REQUEST_INTERVAL_SECONDS)
    _first_request = False
    return await coro_factory()


def parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.strptime(value[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def apply_profile(player, profile: dict, *, overwrite: bool = False) -> set[str]:
    """Copy a `player` block onto our row. Returns the field names changed.

    Pure apart from the attribute writes, so it is the one thing here worth a
    unit test. Only fills NULLs by default: nationality and date_of_birth may
    already have come from football-data.org, and a hand-corrected value should
    not be silently replaced by a provider that disagrees.
    """
    incoming = {
        "height": (profile.get("height") or "").strip() or None,
        "weight": (profile.get("weight") or "").strip() or None,
        "date_of_birth": parse_date((profile.get("birth") or {}).get("date")),
        "nationality": (profile.get("nationality") or "").strip() or None,
    }
    changed = set()
    for field, value in incoming.items():
        if value is None:
            continue
        current = getattr(player, field)
        if current is not None and not overwrite:
            continue
        if current != value:
            setattr(player, field, value)
            changed.add(field)
    return changed


def budget_exhausted(ignore: bool) -> bool:
    """True when the next request would eat into the match-day reserve.

    `FOOTBALL_API_DAILY_BUDGET = 0` means an unmetered paid plan, matching the
    client's own escape hatch.
    """
    budget = settings.FOOTBALL_API_DAILY_BUDGET
    if ignore or budget == 0:
        return False
    return quota_used_today() >= budget - settings.FOOTBALL_LINEUP_QUOTA_RESERVE


class Tally:
    def __init__(self) -> None:
        self.counts = dict.fromkeys(FIELDS, 0)
        self.matched = 0
        self.seen = 0
        self.unmapped_flags: set[str] = set()

    def record(self, changed: set[str], nationality: str | None) -> None:
        self.matched += 1
        for field in changed:
            self.counts[field] += 1
        if nationality and not iso_code(nationality):
            self.unmapped_flags.add(nationality)

    def report(self) -> None:
        print(f"\nfeed rows seen : {self.seen}")
        print(f"matched to pool: {self.matched}")
        for field in FIELDS:
            print(f"  {field:15} {self.counts[field]}")
        if self.unmapped_flags:
            # A nationality with no ISO code renders no flag, so surface it
            # rather than letting it fail silently in the UI.
            print(f"\nNationalities with no flag mapping ({len(self.unmapped_flags)}):")
            for name in sorted(self.unmapped_flags):
                print(f"  {name!r}  -> add to app/services/sync/nationalities.py")


async def sweep_teams(client, db, pool, args, tally: Tally) -> bool:
    """Walk each club's 2024 player pages. Returns False if the budget ran out."""
    redis = get_redis()

    sport_id = db.query(Sport.id).filter(Sport.name == "football").one()[0]
    tags = {c.tag for c in fantasy_competitions().values()}
    clubs = [
        ClubRef(row.id, row.name, row.competition, row.logo_url)
        for row in db.query(RealTeam)
        .filter(RealTeam.sport_id == sport_id, RealTeam.competition.in_(tags))
        .order_by(RealTeam.competition, RealTeam.name)
    ]
    # 3 requests, and they are the same lookups sync_player_clubs.py makes, so
    # they are usually already in the 24h response cache.
    team_ids = await resolve_team_ids(client, clubs)
    state = redis.hgetall(STATE_KEY) or {}
    print(f"clubs: {len(clubs)}   already finished: "
          f"{sum(1 for v in state.values() if v == DONE)}")

    for club in clubs:
        team_id = team_ids[club.id]
        cursor = state.get(str(team_id), "1")
        if cursor == DONE:
            continue
        page = int(cursor)
        before = tally.matched

        while page <= MAX_PAGE:
            if budget_exhausted(args.ignore_budget):
                print(f"\nDaily API budget reached at {club.name} page {page}.")
                return False
            try:
                payload = await paced(
                    lambda: client.get_team_players(team_id, SEASON, page)
                )
            except FootballQuotaExhausted:
                print(f"\nAPI refused at {club.name} page {page} "
                      f"(daily budget or the 10/min cap).")
                return False

            if payload.get("errors"):
                print(f"  {club.name}: provider error {payload['errors']}")
                return False

            total = (payload.get("paging") or {}).get("total") or 1
            for row in payload.get("response") or []:
                profile = row.get("player") or {}
                tally.seen += 1
                player = pool.get(str(profile.get("id")))
                if player is None:
                    continue
                tally.record(
                    apply_profile(player, profile, overwrite=args.overwrite),
                    player.nationality,
                )

            last = page >= min(total, MAX_PAGE)
            if args.apply:
                db.commit()
                # Advance only after the page is committed, so an interruption
                # costs at most one page of re-reading.
                redis.hset(STATE_KEY, str(team_id), DONE if last else str(page + 1))

            page += 1
            if last or (not args.apply and page > args.pages):
                break

        print(f"  {club.competition:11} {club.name:28} "
              f"+{tally.matched - before} matched")

    return True


async def sweep_stragglers(client, db, pool, args, tally: Tally) -> bool:
    """One request per player still missing a height. Self-resuming: the
    selection IS the progress marker."""
    targets = [player for player in pool.values() if player.height is None]
    print(f"\n=== STRAGGLERS ({len(targets)}) — 1 request each ===")

    for done, player in enumerate(targets, start=1):
        if budget_exhausted(args.ignore_budget):
            print(f"\nDaily API budget reached after {done - 1} straggler(s).")
            return False
        try:
            payload = await paced(
                lambda: client.get_player_by_id(int(player.external_api_id), SEASON)
            )
        except FootballQuotaExhausted:
            print(f"\nDaily API budget spent after {done - 1} straggler(s).")
            return False

        rows = payload.get("response") or []
        tally.seen += 1
        if rows:
            changed = apply_profile(player, rows[0].get("player") or {},
                                    overwrite=args.overwrite)
            tally.record(changed, player.nationality)

        if args.apply and done % COMMIT_EVERY == 0:
            db.commit()
            print(f"  {done}/{len(targets)}  matched={tally.matched}", flush=True)
        if not args.apply and done >= args.pages:
            print(f"  dry run — stopping after {args.pages} lookup(s)")
            break

    return True


async def run(args) -> int:
    db = SessionLocal()
    try:
        sport = db.query(Sport).filter(Sport.name == "football").one()
        players = db.query(Player).filter(Player.sport_id == sport.id).all()
        pool = {
            player.external_api_id: player for player in players
            if (player.external_api_id or "").isdigit()
        }
        print(f"pool: {len(players)} football players, {len(pool)} with an "
              f"API-Football id")
        print(f"quota used today: {quota_used_today()}/"
              f"{settings.FOOTBALL_API_DAILY_BUDGET} "
              f"(reserve {settings.FOOTBALL_LINEUP_QUOTA_RESERVE})")

        client = FootballAPIClient()
        tally = Tally()
        try:
            if args.straggler:
                completed = await sweep_stragglers(client, db, pool, args, tally)
            else:
                completed = await sweep_teams(client, db, pool, args, tally)
        finally:
            # Keep whatever this run resolved even if it was cut short.
            if args.apply:
                db.commit()
            tally.report()

        if not args.apply:
            db.rollback()
            print("\nDRY RUN — nothing written. Re-run with --apply to commit.")
            return 0

        from app.player import read_cache as player_read_cache
        player_read_cache.bust_all()
        if completed:
            print("\nCommitted, player read cache busted. Sweep complete.")
        else:
            print("\nCommitted, player read cache busted. Re-run tomorrow to "
                  "resume from the stored page.")
        return 0
    finally:
        db.close()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Commit the changes.")
    parser.add_argument(
        "--overwrite", action="store_true",
        help="Replace existing values. Default only fills in NULLs.",
    )
    parser.add_argument(
        "--straggler", action="store_true",
        help="Fetch players still missing a height one at a time (1 request each).",
    )
    parser.add_argument(
        "--ignore-budget", action="store_true",
        help="Ignore the match-day reserve floor. Only on a day with no fixtures.",
    )
    parser.add_argument(
        "--pages", type=int, default=1,
        help="Dry-run only: how many pages/lookups to sample per club.",
    )
    return asyncio.run(run(parser.parse_args()))


if __name__ == "__main__":
    raise SystemExit(main())

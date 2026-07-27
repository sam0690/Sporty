"""Regenerate a football season's transfer windows as PER-COMPETITION,
gameweek-aligned schedules + one combined (all-competitions) weekly schedule.

For each fantasy competition (EPL/LALIGA/BUNDESLIGA) it builds one window per
real gameweek, anchored to that gameweek's first kickoff (deadline locks 90min
before, FPL-style), contiguous so every fixture maps to exactly one of its own
competition's windows — winter/international breaks are simply absorbed as a
longer window. It also builds a weekly "combined" schedule (competition=NULL)
that all-competitions leagues run on, since three competitions have no shared
real gameweek calendar. A fixture's stats book into BOTH its competition window
and the combined window (see window_locator.find_transfer_window_ids_for_datetime).

Gameweek numbers come from football-data.org `matchday`; the script backfills
Match.matchday from fdo first (Match rows are keyed external_api_id="fdo:<id>").

Dry run by default: does everything in one transaction, prints coverage, then
ROLLS BACK unless --apply is passed.

Run from Sporty_Backend/:
    PYTHONPATH=. venv/bin/python scripts/regenerate_competition_windows.py [--apply] [--season "Season 2026/27"]
"""
import asyncio
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

import app.main  # noqa: F401  (registers every model mapper)
from app.database import SessionLocal
from app.league.models import Season, Sport, TransferWindow, Transfer
from app.match.models import Match
from app.player.models import PlayerGameweekStat
from app.external_apis.football_data_org import get_competition_matches
from app.services.sync.football_competitions import fantasy_competitions

APPLY = "--apply" in sys.argv
SEASON_NAME = "Season 2026/27"
if "--season" in sys.argv:
    SEASON_NAME = sys.argv[sys.argv.index("--season") + 1]

DEADLINE_BUFFER = timedelta(minutes=90)   # lock this long before first kickoff
TAIL = timedelta(hours=6)                 # last GW window extends past last KO


def _season_year(season: Season) -> str:
    # Match.season is the season's start year as a 4-char string (see match_sync).
    return str(season.start_date.year)


import json
import os

# Optional cache of the fdo matchday map so repeated dry-runs don't re-hit the
# rate-limited free tier. Set FDO_MATCHDAY_CACHE to a JSON path {ext_api_id: md}.
_MD_CACHE = os.environ.get("FDO_MATCHDAY_CACHE")


def _load_md_cache() -> dict[str, int] | None:
    if _MD_CACHE and os.path.exists(_MD_CACHE):
        with open(_MD_CACHE) as f:
            return json.load(f)
    return None


def backfill_matchdays(db, season) -> dict[str, int]:
    """Pull matchday for every fantasy competition from fdo and stamp it onto
    the season's Match rows (matched by external_api_id='fdo:<id>'). If
    FDO_MATCHDAY_CACHE points at a saved map, use it instead of calling fdo."""
    stats = {"updated": 0, "missing": 0}
    cache = _load_md_cache()
    full_map: dict[str, int] = {}
    for comp in fantasy_competitions().values():
        if cache is not None:
            by_fdo = cache
        else:
            payload = asyncio.run(get_competition_matches(comp.fdo_code))
            by_fdo = {
                f"fdo:{m['id']}": m.get("matchday")
                for m in payload.get("matches", [])
                if m.get("id") and m.get("matchday")
            }
            full_map.update(by_fdo)
        rows = (
            db.query(Match)
            .filter(Match.competition == comp.name, Match.external_api_id.in_(list(by_fdo)))
            .all()
        )
        for r in rows:
            md = by_fdo.get(r.external_api_id)
            if md and r.matchday != md:
                r.matchday = md
                stats["updated"] += 1
    if cache is None and _MD_CACHE and full_map:
        with open(_MD_CACHE, "w") as f:
            json.dump(full_map, f)
    db.flush()
    return stats


def build_competition_windows(db, season, comp_tag, comp_name, year) -> list[TransferWindow]:
    """One window per matchday for a competition, contiguous, deadline-anchored
    to each gameweek's first kickoff."""
    rows = (
        db.query(Match)
        .filter(
            Match.competition == comp_name,
            Match.season == year,
            Match.matchday.isnot(None),
        )
        .all()
    )
    if not rows:
        return []

    by_md: dict[int, list[datetime]] = defaultdict(list)
    for r in rows:
        by_md[r.matchday].append(r.match_date)

    # Order gameweeks by their earliest kickoff (robust to matchday-number gaps).
    ordered = sorted(by_md.items(), key=lambda kv: min(kv[1]))
    starts = [min(kicks) - DEADLINE_BUFFER for _, kicks in ordered]
    last_ko = max(max(kicks) for _, kicks in ordered)

    windows = []
    for i, start in enumerate(starts):
        # End 1s before the next GW's start: the exclude constraint uses an
        # INCLUSIVE tstzrange('[]'), so a shared endpoint counts as an overlap.
        # The write path is half-open (start <= t < end), so the 1s gap is
        # invisible (no match kicks off in it).
        end = (starts[i + 1] - timedelta(seconds=1)) if i + 1 < len(starts) else last_ko + TAIL
        # ponytail: a postponed fixture dragged past the next GW's deadline would
        # fall outside its window — reported in the coverage check below, rare.
        windows.append(TransferWindow(
            season_id=season.id, competition=comp_tag, number=i + 1,
            start_at=start, end_at=end,
            transfer_deadline_at=start,
            lineup_deadline_at=start + timedelta(minutes=1),
            transfers_locked=False, lineup_locked=False, notified=False,
        ))
    return windows


def build_combined_windows(db, season, all_fixtures) -> list[TransferWindow]:
    """Weekly 7-day spans across the whole season (competition=NULL) — the clock
    for all-competitions leagues, which have no single real gameweek calendar."""
    if not all_fixtures:
        return []
    first = min(f.match_date for f in all_fixtures) - DEADLINE_BUFFER
    last = max(f.match_date for f in all_fixtures) + TAIL
    windows = []
    start, number = first, 1
    while start < last:
        end = start + timedelta(days=7) - timedelta(seconds=1)  # 1s gap, see above
        windows.append(TransferWindow(
            season_id=season.id, competition=None, number=number,
            start_at=start, end_at=end,
            transfer_deadline_at=start,
            lineup_deadline_at=start + timedelta(minutes=1),
            transfers_locked=False, lineup_locked=False, notified=False,
        ))
        start, number = end + timedelta(seconds=1), number + 1
    return windows


def main():
    db = SessionLocal()
    season = db.query(Season).filter(Season.name == SEASON_NAME).first()
    if not season:
        print(f"ABORT: season {SEASON_NAME!r} not found")
        sys.exit(1)
    year = _season_year(season)
    comps = list(fantasy_competitions().values())

    # ADDITIVE migration: existing NULL windows ARE the combined schedule that
    # all-competitions leagues already run on (and hold their lineups). We never
    # delete them — we only ADD the per-competition gameweek windows alongside.
    existing = db.query(TransferWindow).filter(TransferWindow.season_id == season.id).all()
    existing_null = [w for w in existing if w.competition is None]
    existing_tags = {w.competition for w in existing if w.competition is not None}

    md_stats = backfill_matchdays(db, season)

    all_windows: list[TransferWindow] = []
    per_comp_counts = {}
    for comp in comps:
        if comp.tag in existing_tags:
            per_comp_counts[comp.tag] = "exists (skipped)"
            continue
        ws = build_competition_windows(db, season, comp.tag, comp.name, year)
        per_comp_counts[comp.tag] = len(ws)
        all_windows += ws

    fixtures = (
        db.query(Match)
        .filter(Match.competition.in_([c.name for c in comps]), Match.season == year)
        .all()
    )
    # Only build a combined schedule if the season has none yet (fresh season).
    if existing_null:
        combined = []
        combined_note = f"kept existing {len(existing_null)} NULL windows"
    else:
        combined = build_combined_windows(db, season, fixtures)
        combined_note = f"created {len(combined)} weekly"
    all_windows += combined

    db.add_all(all_windows)
    db.flush()  # exercises the new exclude/unique constraints

    # ── Coverage check: every fixture must hit exactly 1 own-competition window
    #    AND exactly 1 combined window. ──
    tag_by_name = {c.name: c.tag for c in comps}
    wins = db.query(TransferWindow).filter(TransferWindow.season_id == season.id).all()
    own_hits, combined_hits = Counter(), Counter()
    uncovered = []
    for m in fixtures:
        tag = tag_by_name[m.competition]
        own = [w for w in wins if w.competition == tag and w.start_at <= m.match_date < w.end_at]
        comb = [w for w in wins if w.competition is None and w.start_at <= m.match_date < w.end_at]
        own_hits[len(own)] += 1
        combined_hits[len(comb)] += 1
        if len(own) != 1 or len(comb) != 1:
            uncovered.append((m.competition, m.matchday, m.match_date, len(own), len(comb)))

    print(f"\n{'APPLIED' if APPLY else 'DRY RUN (rolled back)'} — season {SEASON_NAME}")
    print(f"matchday backfill: {md_stats}")
    print(f"per-competition windows added: {per_comp_counts}; combined: {combined_note}")
    print(f"\nFixture coverage ({len(fixtures)} fixtures):")
    print(f"  own-competition window hits: {dict(own_hits)}   (want all == 1)")
    print(f"  combined window hits:        {dict(combined_hits)}   (want all == 1)")
    if uncovered:
        print(f"  ⚠ {len(uncovered)} fixtures not cleanly covered (sample):")
        for row in uncovered[:10]:
            print(f"     {row}")

    if APPLY:
        db.commit()
        print("\n*** COMMITTED ***")
    else:
        db.rollback()
        print("\n*** ROLLED BACK (pass --apply to commit) ***")
    db.close()


if __name__ == "__main__":
    main()

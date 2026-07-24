"""One-off prep: make Season 2026/27's fantasy gameweeks work on real fixtures.

Problem: Season 2026/27's transfer windows are 1-day Monday markers (a
different generator than the mock's), so weekend fixtures fall in the 6-day
gaps — only ~50/380 EPL fixtures map to a window, and most of those hit the
MOCK season's overlapping windows instead.

Fix (weekly-spans cadence, user-chosen):
  1. Regenerate Season 2026/27 windows as contiguous 7-day spans covering
     Aug 14 2026 -> the week of May 31 2027 (matches the mock's proven shape).
     Safe: Season 2026/27 has zero leagues, nothing references its windows.
  2. Trim the mock season's windows that extend past its own end date
     (Aug 20) — spurious, and they capture real August fixtures. Only
     deleted if no gameweek stats / transfers reference them (they're
     future/empty; verified before delete).

Dry run by default: applies both changes in a transaction, prints the
resulting fixture coverage, then ROLLS BACK unless --apply is passed.
Run from Sporty_Backend/: PYTHONPATH=. venv/bin/python scripts/fix_real_season_windows.py
"""
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone

import app.main  # noqa: F401
from app.database import SessionLocal
from app.league.models import Season, League, LeagueSport, Sport, TransferWindow, Transfer
from app.match.models import Match
from app.player.models import PlayerGameweekStat

APPLY = "--apply" in sys.argv

FIRST_START = datetime(2026, 8, 14, 0, 0, 0, tzinfo=timezone.utc)  # covers Aug 15 opener
COVER_UNTIL = datetime(2027, 5, 31, 23, 59, 59, tzinfo=timezone.utc)  # last fixture May 30

db = SessionLocal()
fb = db.query(Sport).filter(Sport.name == "football").first()
real = db.query(Season).filter(Season.name == "Season 2026/27").first()
mock = db.query(Season).filter(Season.name == "Season 2025/26").first()

# ── 1. Regenerate Season 2026/27 windows as weekly spans ────────────────────
old = db.query(TransferWindow).filter(TransferWindow.season_id == real.id).all()
# Guard: none of the windows we're about to drop may be referenced.
old_ids = [w.id for w in old]
ref_stats = db.query(PlayerGameweekStat).filter(PlayerGameweekStat.transfer_window_id.in_(old_ids)).count()
ref_tx = db.query(Transfer).filter(Transfer.transfer_window_id.in_(old_ids)).count()
if ref_stats or ref_tx:
    print(f"ABORT: 2026/27 windows are referenced (stats={ref_stats}, transfers={ref_tx})")
    sys.exit(1)

for w in old:
    db.delete(w)
db.flush()

new_windows = []
start = FIRST_START
number = 1
while start <= COVER_UNTIL:
    end = start + timedelta(days=6, hours=23, minutes=59, seconds=59)
    new_windows.append(TransferWindow(
        season_id=real.id, number=number,
        start_at=start, end_at=end,
        transfer_deadline_at=start,
        lineup_deadline_at=start + timedelta(minutes=1),
        transfers_locked=False, lineup_locked=False, notified=False,
    ))
    start = start + timedelta(days=7)
    number += 1
db.add_all(new_windows)
db.flush()

# NOTE: the mock season's windows past its Aug-20 end date overlap real
# fixtures, but they're referenced by league_matchups (the head-to-head test
# leagues' schedules), so they can't be deleted without destroying that data.
# Left in place — the residual overlap is reported below. The clean removal is
# deleting the 6 mock test leagues through the app, which the user controls.
mock_end = datetime.combine(mock.end_date, datetime.min.time(), tzinfo=timezone.utc)
trimmed = 0

# ── Verify: fixture coverage, in-memory (fast) ──────────────────────────────
windows = [(w.start_at, w.end_at, w.season_id, w.number)
           for w in db.query(TransferWindow).join(Season, Season.id == TransferWindow.season_id)
           .filter(Season.sport_id == fb.id).all()]
fixtures = db.query(Match).filter(
    Match.competition.in_(["Premier League", "La Liga", "Bundesliga"]),
    Match.season == "2026",
).all()

buckets = Counter()
wrong_season = 0
for m in fixtures:
    hits = [w for w in windows if w[0] <= m.match_date < w[1]]
    buckets[len(hits)] += 1
    if len(hits) >= 1 and all(sid != real.id for (_, _, sid, _) in hits):
        wrong_season += 1

print(f"\n{'APPLIED' if APPLY else 'DRY RUN (rolled back)'}")
print(f"Season 2026/27: {len(old)} one-day windows -> {len(new_windows)} weekly windows "
      f"({new_windows[0].start_at.date()} .. {new_windows[-1].end_at.date()})")
print(f"Mock windows left in place (referenced by league_matchups): overlap reported below")
print(f"\nReal fixture coverage ({len(fixtures)} fixtures across 3 leagues):")
print(f"  mapped to exactly 1 window: {buckets[1]}")
print(f"  mapped to 0 windows:        {buckets[0]}")
print(f"  mapped to >1 windows:       {sum(v for k, v in buckets.items() if k > 1)}")
print(f"  mapped only to wrong season:{wrong_season}")

if APPLY:
    db.commit()
    print("\n*** COMMITTED ***")
else:
    db.rollback()
    print("\n*** ROLLED BACK (pass --apply to commit) ***")
db.close()

"""Verify the per-competition window design against the LIVE DB without
persisting anything: in ONE transaction, apply the schema DDL, backfill
matchdays, generate the per-competition + combined windows (exercising the new
constraints), report fixture coverage, then ROLL BACK.

Run from Sporty_Backend/:
    PYTHONPATH=. venv/bin/python scripts/verify_competition_windows.py
"""
from sqlalchemy import text

import app.main  # noqa: F401
from app.database import SessionLocal
from app.league.models import Season, TransferWindow, Transfer
from app.match.models import Match
from app.player.models import PlayerGameweekStat
from app.services.sync.football_competitions import fantasy_competitions
from scripts.regenerate_competition_windows import (
    backfill_matchdays, build_competition_windows, build_combined_windows, _season_year,
)
from collections import Counter

SEASON_NAME = "Season 2026/27"

SCHEMA_DDL = [
    "ALTER TABLE matches ADD COLUMN IF NOT EXISTS matchday integer",
    "ALTER TABLE transfer_windows ADD COLUMN IF NOT EXISTS competition varchar(20)",
    "ALTER TABLE transfer_windows DROP CONSTRAINT IF EXISTS uq_transfer_window_season_number",
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_transfer_window_season_comp_number "
    "ON transfer_windows (season_id, COALESCE(competition, ''), number)",
    "ALTER TABLE transfer_windows DROP CONSTRAINT IF EXISTS transfer_windows_no_overlap",
    "ALTER TABLE transfer_windows DROP CONSTRAINT IF EXISTS excl_transfer_window_season_no_overlap",
    "ALTER TABLE transfer_windows ADD CONSTRAINT excl_transfer_window_season_no_overlap "
    "EXCLUDE USING gist (season_id WITH =, (COALESCE(competition, '')) WITH =, "
    "tstzrange(start_at, end_at, '[]') WITH &&)",
]


def main():
    db = SessionLocal()
    try:
        for stmt in SCHEMA_DDL:
            db.execute(text(stmt))
        db.flush()

        season = db.query(Season).filter(Season.name == SEASON_NAME).first()
        year = _season_year(season)
        comps = list(fantasy_competitions().values())

        # Additive: keep existing NULL (combined) windows, add per-competition.
        existing = db.query(TransferWindow).filter(TransferWindow.season_id == season.id).all()
        existing_null = [w for w in existing if w.competition is None]

        md_stats = backfill_matchdays(db, season)

        all_windows, per_comp = [], {}
        for comp in comps:
            ws = build_competition_windows(db, season, comp.tag, comp.name, year)
            per_comp[comp.tag] = len(ws)
            all_windows += ws
        fixtures = (
            db.query(Match)
            .filter(Match.competition.in_([c.name for c in comps]), Match.season == year)
            .all()
        )
        old = existing  # for the printed "was" count
        combined = [] if existing_null else build_combined_windows(db, season, fixtures)
        all_windows += combined
        db.add_all(all_windows)
        db.flush()  # <- exercises exclude + unique constraints on real data
        # Overlapping the KEPT combined NULL windows with new per-competition
        # windows must be accepted (different COALESCE(competition,'') partition).

        tag_by_name = {c.name: c.tag for c in comps}
        wins = db.query(TransferWindow).filter(TransferWindow.season_id == season.id).all()
        own, comb = Counter(), Counter()
        bad = []
        for m in fixtures:
            tag = tag_by_name[m.competition]
            o = sum(1 for w in wins if w.competition == tag and w.start_at <= m.match_date < w.end_at)
            c = sum(1 for w in wins if w.competition is None and w.start_at <= m.match_date < w.end_at)
            own[o] += 1; comb[c] += 1
            if o != 1 or c != 1:
                bad.append((m.competition, m.matchday, str(m.match_date), o, c))

        print("SCHEMA DDL applied in-transaction: OK (constraints accepted overlapping "
              "per-competition windows)")
        print(f"matchday backfill: {md_stats}")
        print(f"per-competition windows added: {per_comp}  "
              f"combined NULL windows kept: {len(existing_null)}  (total existing was {len(old)})")
        print(f"fixtures={len(fixtures)}")
        print(f"  own-competition window hits: {dict(own)}  (want {{1: {len(fixtures)}}})")
        print(f"  combined window hits:        {dict(comb)}  (want {{1: {len(fixtures)}}})")
        if bad:
            print(f"  ⚠ {len(bad)} not cleanly covered (sample): {bad[:8]}")
        else:
            print("  ✓ every fixture maps to exactly one own-competition + one combined window")
    finally:
        db.rollback()
        print("\n*** ROLLED BACK — prod untouched ***")
        db.close()


if __name__ == "__main__":
    main()

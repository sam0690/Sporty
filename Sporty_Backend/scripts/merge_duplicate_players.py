"""Merge players that exist twice: a legacy CSV-importer row and a real one.

THE SHAPE OF THE BUG
--------------------
`app/ingestion/dataset_importer.py` created players with a slug external id
(`football:marc_cucurella:chelsea:def`). Later ingestion linked the same
people to API-Football numeric ids. When a player then changed club — or was
simply spelled differently by the two sources — the two rows stopped folding
to the same identity and `uq_players_identity` (sport, folded name,
real_team_id) no longer caught them, so both survive and both show up in
search:

    Marc Cucurella   Chelsea      slug     is_available=False  17.00
    Marc Cucurella   Real Madrid  47380    is_available=True    4.50

Two variants exist. Cross-competition (the player left the league and the
stale EPL copy remains) and, worse, same-club pairs where BOTH rows are
active and selectable — "Ben Gannon-Doak" and "B. Doak" both at Bournemouth.

WHAT THIS DOES
--------------
Keeps the numeric-id row and deletes the slug row, because only the numeric
id resolves in live scoring (`football_live_sync._resolve_player`); a slug
row would silently score zero all season. Every foreign key is repointed to
the survivor first, using the same collision-guarded machinery as
alembic/versions/e2f6c8a94b13_merge_mojibake_player_dupes.py.

The survivor then adopts whichever of the two names is more complete, so the
merge does not leave "B. Doak" as the display name when "Ben Gannon-Doak" was
available. Renames run AFTER the delete so they cannot trip uq_players_identity.

Pairs are identified with app/services/sync/name_matching.py rather than SQL,
because the spellings differ by more than punctuation. A goalkeeper/outfield
disagreement vetoes a pair — that is how two different people who share a name
(the Álvaro Fernández at Deportivo is a keeper, the one at Real Madrid a
defender) are kept apart.

Run manually (verify with the default dry-run first):
    venv/bin/python scripts/merge_duplicate_players.py
    venv/bin/python scripts/merge_duplicate_players.py --apply
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import app.main  # noqa: F401 — registers all model modules so relationships resolve

from sqlalchemy import text

from app.database import SessionLocal
from app.league.models import Sport
from app.player.models import Player, RealTeam
from app.services.sync.name_matching import Candidate, NameIndex, normalize

# Child tables with a UNIQUE constraint that includes the player column:
# rows that would collide with the survivor are deleted, then the rest are
# repointed. (table, player column, extra columns forming the constraint)
COLLISION_GUARDED = [
    ("team_players", "player_id", ["fantasy_team_id", "acquired_window_id"]),
    ("team_gameweek_lineups", "player_id", ["fantasy_team_id", "transfer_window_id"]),
    ("player_gameweek_stats", "player_id", ["transfer_window_id"]),
    ("draft_picks", "player_id", ["league_id"]),
]

# No unique constraint involving the player column — straight repoint.
PLAIN_REPOINT = [
    ("player_price_history", "player_id"),
    ("player_match_scores", "player_id"),
    ("budget_transactions", "player_id"),
    ("user_favourite_players", "player_id"),
    ("transfers", "player_in_id"),
    ("transfers", "player_out_id"),
    ("roster_moves", "add_player_id"),
    ("roster_moves", "drop_player_id"),
    ("waiver_claims", "add_player_id"),
    ("waiver_claims", "drop_player_id"),
]


# Pairs the automatic matcher cannot reach, verified by hand 2026-08-15.
#
# All are same-club pairs where an apostrophe was HTML-escaped into the name
# ("N. O&apos;Reilly"), which splits into an extra token and defeats the
# given-name comparison. They are listed explicitly rather than by loosening
# the matcher, because every loosening that catches these also merges
# genuinely different people who share a family name and initial — the pool
# holds "J. Bellingham" at Real Madrid AND at Dortmund (Jude and Jobe), and
# "B. Johnson"/"Brennan Johnson" (Ben and Brennan).
#
# Corroboration for each: same club, compatible position, and an identical
# cost, because the FPL re-seed matched both rows to the same element. The
# deliberately EXCLUDED same-club pairs all fail that test — M. Llorente
# (5.50 FWD) vs Marcos Llorente (4.50 DEF), I. Munoz (4.50 DEF) vs Iker Muñoz
# (5.00 MID), J. Jones (4.50 DEF) vs Jenson Jones (5.00 MID) — each side has
# its own API-Football id, so the provider considers them different people.
#
# (dup external_api_id, keep external_api_id, canonical name)
EXPLICIT_PAIRS = [
    (
        "football:matt_o_riley:brighton_amp_hove_albion:mid",
        "19030",
        "Matt O'Riley",
    ),
    ("football:jamie_gittens:chelsea:mid", "286894", "Jamie Bynoe-Gittens"),
    ("football:jake_o_brien:everton:def", "270139", "Jake O'Brien"),
    ("football:nico_o_reilly:manchester_city:def", "307123", "Nico O'Reilly"),
    ("football:luke_o_nien:sunderland:def", "19911", "Luke O'Nien"),
    # Both sides are legacy slug rows here; keep the fuller spelling.
    (
        "football:idrissa_gueye:everton:mid",
        "football:idrissa_gana_gueye:everton:mid",
        "Idrissa Gana Gueye",
    ),
]


def _is_keeper(position: str | None) -> bool:
    return (position or "").strip().upper() in {"GKP", "GK"}


def _name_completeness(name: str) -> int:
    """How many real words a name has — "B. Doak" scores 1, "Ben Doak" 2."""
    return sum(1 for token in normalize(name).split() if len(token) > 1)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Commit the merge.")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        sport = db.query(Sport).filter(Sport.name == "football").one()
        rows = (
            db.query(Player, RealTeam.competition)
            .join(RealTeam, RealTeam.id == Player.real_team_id)
            .filter(Player.sport_id == sport.id)
            .all()
        )
        slug_rows = [(p, c) for p, c in rows if (p.external_api_id or "").startswith("football:")]
        numeric_rows = [(p, c) for p, c in rows if (p.external_api_id or "").isdigit()]
        print(f"slug rows: {len(slug_rows)}   numeric-id rows: {len(numeric_rows)}")

        index = NameIndex.build(
            Candidate.from_full_name(p.name, club=p.real_team, payload=(p, c))
            for p, c in numeric_rows
        )

        pairs: list[tuple[Player, Player, str]] = []
        for dup, dup_comp in slug_rows:
            matched = index.match(dup.name, club=dup.real_team)
            if matched is None:
                continue
            keep, keep_comp = matched
            if keep.id == dup.id:
                continue
            if _is_keeper(dup.position) != _is_keeper(keep.position):
                continue  # same name, different people

            # Prefer the fuller spelling; on a tie keep the provider's own.
            canonical = (
                dup.name
                if _name_completeness(dup.name) > _name_completeness(keep.name)
                else keep.name
            )
            pairs.append((dup, keep, canonical))
            print(
                f"\n  DUP  {dup.name:<26} {dup.real_team:<20} ({dup_comp}) "
                f"avail={dup.is_available} cost={dup.cost}"
            )
            print(
                f"  KEEP {keep.name:<26} {keep.real_team:<20} ({keep_comp}) "
                f"avail={keep.is_available} cost={keep.cost}"
            )
            if canonical != keep.name:
                print(f"       rename survivor -> {canonical!r}")

        by_external = {p.external_api_id: p for p, _ in rows}
        for dup_ext, keep_ext, canonical in EXPLICIT_PAIRS:
            dup, keep = by_external.get(dup_ext), by_external.get(keep_ext)
            if dup is None or keep is None:
                continue  # already merged by a previous run
            pairs.append((dup, keep, canonical))
            print(f"\n  DUP  {dup.name:<26} {dup.real_team:<20} (explicit) cost={dup.cost}")
            print(f"  KEEP {keep.name:<26} {keep.real_team:<20} (explicit) cost={keep.cost}")
            if canonical != keep.name:
                print(f"       rename survivor -> {canonical!r}")

        if not pairs:
            print("\nNo duplicates found.")
            return 0

        dup_ids = [d.id for d, _, _ in pairs]
        print(f"\nPairs to merge: {len(pairs)}")

        print("\nReferences that will move to the survivor:")
        for table, column, _ in COLLISION_GUARDED:
            n = db.execute(
                text(f"select count(*) from {table} where {column} = any(:ids)"),
                {"ids": dup_ids},
            ).scalar()
            if n:
                print(f"  {table}.{column}: {n}")
        for table, column in PLAIN_REPOINT:
            n = db.execute(
                text(f"select count(*) from {table} where {column} = any(:ids)"),
                {"ids": dup_ids},
            ).scalar()
            if n:
                print(f"  {table}.{column}: {n}")

        if not args.apply:
            db.rollback()
            print("\nDRY RUN — nothing written. Re-run with --apply to commit.")
            return 0

        mapping = [{"dup": d.id, "keep": k.id} for d, k, _ in pairs]

        for table, column, extra in COLLISION_GUARDED:
            match_extra = " AND ".join(
                f"k.{col} IS NOT DISTINCT FROM d.{col}" for col in extra
            )
            db.execute(
                text(
                    f"""
                    DELETE FROM {table} d
                    WHERE d.{column} = :dup
                      AND EXISTS (
                          SELECT 1 FROM {table} k
                          WHERE k.{column} = :keep AND {match_extra}
                      )
                    """
                ),
                mapping,
            )
            db.execute(
                text(f"UPDATE {table} SET {column} = :keep WHERE {column} = :dup"),
                mapping,
            )

        for table, column in PLAIN_REPOINT:
            db.execute(
                text(f"UPDATE {table} SET {column} = :keep WHERE {column} = :dup"),
                mapping,
            )

        db.execute(text("DELETE FROM players WHERE id = any(:ids)"), {"ids": dup_ids})

        # After the delete, so a rename cannot collide with the row it replaces.
        for _dup, keep, canonical in pairs:
            if canonical != keep.name:
                db.execute(
                    text("UPDATE players SET name = :name WHERE id = :id"),
                    {"name": canonical, "id": keep.id},
                )

        db.commit()
        print(f"\nMerged {len(pairs)} duplicate player(s).")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())

"""Seed players who appear in a real match sheet but are missing from our pool.

WHY: a player who is not in `players` can neither be picked nor scored, and we
only discover the gap when they turn up in a finished match's full-time sheet.
In La Liga fixture 1570333 that was Orel Mangala (90'), Alberto Risco (24') and
Saba Sazonov (9') — all Getafe, all invisible to the fantasy game.

The match sheet is a better source for this than /players/squads, which the
provider is known to return INCOMPLETE (see the player-club-sync notes: absence
from a squad response never means departure). Anyone who appears on a sheet
with minutes definitively played for that club that day.

Only creates players who are genuinely absent — an entry that resolves by id,
or by club-scoped name match, is left alone. Name-only matches are the id-drift
case that the stats re-book handles; creating a second row for them would
duplicate a player who is already pickable.

Dry run by default; --apply commits. Sheets are read from a cache directory
when present, so a re-run costs no API quota.
Run from Sporty_Backend/:
    PYTHONPATH=. venv/bin/python scripts/seed_players_from_match_sheets.py [--apply]
"""

import json
import os
import sys
from decimal import Decimal
from pathlib import Path

import httpx

import app.main  # noqa: F401 — registers every model before the mappers configure
from app.database import SessionLocal
from app.league.models import Sport
from app.player.models import Player, RealTeam
from app.services.sync.football_live_sync import _club_name_index
from sqlalchemy import text

CACHE = Path(os.environ.get("SHEET_CACHE", "/tmp/ft_sheet_cache"))
CACHE.mkdir(parents=True, exist_ok=True)
APPLY = "--apply" in sys.argv
LOOKBACK_DAYS = int(os.environ.get("LOOKBACK_DAYS", "14"))
# New players enter at the pool minimum, same as every other seeder here.
DEFAULT_COST = Decimal("4.0")
POS_MAP = {"Goalkeeper": "GKP", "Defender": "DEF", "Midfielder": "MID", "Attacker": "FWD",
           "G": "GKP", "D": "DEF", "M": "MID", "F": "FWD"}


def sheet_for(fixture_id: str) -> dict | None:
    """Cached first — a re-run must not spend quota re-reading the same sheet."""
    cached = CACHE / f"sheet_{fixture_id}.json"
    if cached.exists():
        return json.loads(cached.read_text())
    key = next(
        (l.split("=", 1)[1].strip() for l in open(".env") if l.startswith("FOOTBALL_API_KEY=")),
        None,
    )
    host = next(
        (l.split("=", 1)[1].strip() for l in open(".env") if l.startswith("FOOTBALL_API_HOST=")),
        "v3.football.api-sports.io",
    )
    if not key:
        return None
    r = httpx.get(f"https://{host}/fixtures/players", params={"fixture": fixture_id},
                  headers={"x-apisports-key": key}, timeout=30)
    if r.status_code != 200:
        print(f"  ! sheet fetch failed for {fixture_id}: HTTP {r.status_code}")
        return None
    payload = r.json()
    if payload.get("errors"):
        print(f"  ! provider error for {fixture_id}: {payload['errors']}")
        return None
    cached.write_text(json.dumps(payload))
    return payload


def main() -> None:
    db = SessionLocal()
    sport = db.query(Sport).filter(Sport.name == "football").first()
    matches = db.execute(
        text(
            """
            SELECT external_api_id, home_team, away_team, match_date::date AS d
            FROM matches
            WHERE sport_id = :sport_id AND status = 'finished'
              AND external_api_id ~ '^[0-9]+$'
              AND match_date >= now() - make_interval(days => :days)
            ORDER BY match_date DESC
            """
        ),
        {"sport_id": sport.id, "days": LOOKBACK_DAYS},
    ).mappings().all()
    print(f"{len(matches)} finished fixture(s) in the last {LOOKBACK_DAYS} days\n")

    created: list[tuple[str, str, str, int]] = []
    seen_ids: set[str] = set()
    for m in matches:
        sheet = sheet_for(m["external_api_id"])
        if sheet is None:
            continue
        print(f"{m['d']} {m['home_team']} v {m['away_team']} (fixture {m['external_api_id']})")
        for block in sheet.get("response") or []:
            club = (block.get("team") or {}).get("name") or ""
            team_row = (
                db.query(RealTeam)
                .filter(RealTeam.sport_id == sport.id, RealTeam.name == club)
                .first()
            )
            index = None
            for entry in block.get("players") or []:
                info = entry.get("player") or {}
                api_id = str(info.get("id") or "")
                name = info.get("name") or ""
                stats = (entry.get("statistics") or [{}])[0] or {}
                minutes = (stats.get("games") or {}).get("minutes") or 0
                if not api_id or not name or not minutes:
                    continue  # unused subs tell us nothing about squad membership
                if api_id in seen_ids:
                    continue

                if db.query(Player).filter(
                    Player.sport_id == sport.id, Player.external_api_id == api_id
                ).first():
                    continue  # already ours

                if team_row is None:
                    print(f"   ? {name}: club {club!r} not in real_teams — skipped")
                    continue

                # Present under a DIFFERENT provider id: that is id drift, which
                # the stats re-book resolves by name. Creating a row here would
                # duplicate a player who is already in the pool.
                if index is None:
                    index = _club_name_index(db, sport.id, club)
                if index.match(name, club=club) is not None:
                    print(f"   ~ {name}: already in the pool under another id — left alone")
                    continue

                position = POS_MAP.get(str((stats.get("games") or {}).get("position")), "MID")
                print(f"   + CREATE {name} ({club}, {position}, {minutes}')")
                seen_ids.add(api_id)
                created.append((name, club, position, minutes))
                if APPLY:
                    db.add(Player(
                        sport_id=sport.id, external_api_id=api_id, name=name,
                        position=position, real_team=club, real_team_id=team_row.id,
                        cost=DEFAULT_COST, is_available=True,
                    ))
                    db.flush()

    print(f"\n{len(created)} player(s) to create")
    if APPLY and created:
        db.commit()
        print("*** COMMITTED ***")
    elif not APPLY:
        db.rollback()
        print("dry run — nothing written (pass --apply)")


if __name__ == "__main__":
    main()

"""One-off (applied to prod 2026-07-24): link football players to numeric
API-Football ids by name, per 2026-27 EPL squad. Replaced the CSV-era slug
external_api_ids for matched players. Dry run by default; --apply commits.
Run from Sporty_Backend/: PYTHONPATH=. venv/bin/python scripts/link_epl_players.py
"""
import html
import json
import os
import sys
import time
import unicodedata
from pathlib import Path

import httpx

import app.main  # noqa: F401  — registers all model modules
from app.database import SessionLocal
from app.league.models import Sport
from app.player.models import Player

CACHE = Path(os.environ.get("EPL_SYNC_CACHE", "/tmp/epl_api_cache"))
CACHE.mkdir(parents=True, exist_ok=True)
KEY = next(l.split("=", 1)[1].strip() for l in open(".env") if l.startswith("FOOTBALL_API_KEY="))
APPLY = "--apply" in sys.argv

_last_call = [0.0]


def api_get(name: str, path: str, params: dict) -> dict:
    f = CACHE / f"{name}.json"
    if f.exists():
        return json.loads(f.read_text())
    wait = 6.5 - (time.time() - _last_call[0])  # free tier: 10 req/min
    if wait > 0:
        time.sleep(wait)
    r = httpx.get(f"https://v3.football.api-sports.io/{path}", params=params,
                  headers={"x-apisports-key": KEY}, timeout=30)
    r.raise_for_status()
    _last_call[0] = time.time()
    d = r.json()
    if d.get("errors"):
        raise RuntimeError(f"{name}: {d['errors']}")
    f.write_text(json.dumps(d))
    return d


def fold(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    return "".join(c for c in s if not unicodedata.combining(c)).lower().strip()


# ── 2026-27 EPL clubs: API team id + DB real_team name ──────────────────────
KNOWN_IDS = {"Manchester United": 33, "Newcastle": 34, "Bournemouth": 35, "Fulham": 36,
             "Liverpool": 40, "Arsenal": 42, "Everton": 45, "Tottenham": 47,
             "Chelsea": 49, "Manchester City": 50, "Brighton": 51, "Crystal Palace": 52,
             "Brentford": 55, "Ipswich": 57, "Nottingham Forest": 65, "Aston Villa": 66}
API_TO_DB = {"Newcastle": "Newcastle United", "Tottenham": "Tottenham Hotspur",
             "Brighton": html.unescape("Brighton &amp; Hove Albion"),
             "Leeds": "Leeds United"}
SEARCH_NEEDED = ["Leeds", "Sunderland", "Coventry", "Hull"]

team_ids = dict(KNOWN_IDS)
for name in SEARCH_NEEDED:
    d = api_get(f"search_{name}", "teams", {"search": name})
    hits = [(t["team"]["id"], t["team"]["name"], t["team"].get("country")) for t in d["response"]]
    england = [h for h in hits if h[2] == "England"]
    pick = england[0] if england else hits[0]
    team_ids[name] = pick[0]
    print(f"search {name}: picked {pick}  (of {len(hits)} hits)")

# Restore the &amp;-escaped Brighton name exactly as stored in prod
API_TO_DB["Brighton"] = "Brighton &amp; Hove Albion"

# ── DB players by club ──────────────────────────────────────────────────────
db = SessionLocal()
fb = db.query(Sport).filter(Sport.name == "football").first()
players = db.query(Player).filter(Player.sport_id == fb.id).all()
by_club: dict[str, list[Player]] = {}
for p in players:
    by_club.setdefault(p.real_team or "?", []).append(p)

POS_MAP = {"Goalkeeper": "GK", "Defender": "DEF", "Midfielder": "MID", "Attacker": "FWD"}

linked, ambiguous, api_only, already = [], [], [], 0
db_matched_ids = set()

for api_name, tid in sorted(team_ids.items()):
    d = api_get(f"squad_{tid}", "players/squads", {"team": tid})
    squad = d["response"][0]["players"] if d["response"] else []
    db_name = API_TO_DB.get(api_name, api_name)
    club_players = by_club.get(db_name, [])
    club_index: dict[str, list[Player]] = {}
    for p in club_players:
        club_index.setdefault(fold(p.name).split()[-1], []).append(p)

    for sp in squad:
        api_id, name, pos = sp["id"], sp["name"], POS_MAP.get(sp.get("position"), sp.get("position"))
        fname = fold(name)
        surname = fname.split()[-1]
        cands = club_index.get(surname, [])
        # full-name match first, then initial match ("b. fernandes" vs "bruno fernandes")
        exact = [p for p in cands if fold(p.name) == fname]
        if not exact and len(fname.split()) > 1 and fname.split()[0].rstrip(".") and len(fname.split()[0].rstrip(".")) <= 2:
            initial = fname.split()[0].rstrip(".")[0]
            exact = [p for p in cands if fold(p.name)[0] == initial]
        if not exact and len(cands) == 1:
            exact = cands  # unique surname in club
        if len(exact) == 1:
            p = exact[0]
            if p.external_api_id == str(api_id):
                already += 1
            else:
                linked.append((p.name, db_name, p.external_api_id, api_id))
                if APPLY:
                    p.external_api_id = str(api_id)
            db_matched_ids.add(p.id)
        elif len(exact) > 1:
            ambiguous.append((name, db_name, [p.name for p in exact]))
        else:
            api_only.append((name, api_name, pos))

db_only = [p for p in players if p.id not in db_matched_ids]

# ── Cross-club pass: intra-EPL transfers (API squad club != DB club). Strict:
# exact folded-name match, unique on both sides, api_id not already assigned.
assigned_ids = {str(a) for _, _, _, a in linked}
from app.player.models import RealTeam
real_teams = {t.name: t for t in db.query(RealTeam).filter(RealTeam.sport_id == fb.id).all()}
db_only_by_name: dict[str, list[Player]] = {}
for p in db_only:
    db_only_by_name.setdefault(fold(p.name), []).append(p)

moved, still_api_only = [], []
for name, api_club, pos in api_only:
    cands = db_only_by_name.get(fold(name), [])
    db_club = API_TO_DB.get(api_club, api_club)
    sp_id = None
    # recover the api id from the cached squad file
    for tid_name, tid in team_ids.items():
        if tid_name == api_club:
            d = api_get(f"squad_{tid}", "players/squads", {"team": tid})
            for sp in d["response"][0]["players"]:
                if sp["name"] == name:
                    sp_id = sp["id"]
    if len(cands) == 1 and sp_id and str(sp_id) not in assigned_ids:
        p = cands[0]
        moved.append((p.name, p.real_team, "->", db_club, sp_id))
        db_matched_ids.add(p.id)
        assigned_ids.add(str(sp_id))
        if APPLY:
            p.external_api_id = str(sp_id)
            p.real_team = db_club
            team_row = real_teams.get(db_club)
            if team_row is not None:
                p.real_team_id = team_row.id
    else:
        still_api_only.append((name, api_club, pos))
api_only = still_api_only
db_only = [p for p in players if p.id not in db_matched_ids]
print(f"\ncross-club transfers relinked: {len(moved)}")
for m in moved[:20]:
    print("  ", *m)

if APPLY:
    db.commit()
    print("\n*** LINKS COMMITTED ***")
else:
    db.rollback()
    print("\n*** DRY RUN (no writes) ***")

print(f"\nlinked (slug->numeric): {len(linked)} | already numeric: {already} | ambiguous: {len(ambiguous)}")
print(f"in API squads but NOT in DB: {len(api_only)}")
print(f"in DB but not matched to any 2026-27 squad: {len(db_only)}")

from collections import Counter
print("\nmissing players per club:")
for club, n in Counter(t for _, t, _ in api_only).most_common():
    print(f"  {club}: {n}")
print("\nunmatched DB players per club:")
for club, n in Counter(p.real_team or "?" for p in db_only).most_common():
    print(f"  {club}: {n}")
if ambiguous:
    print("\nambiguous:", ambiguous)
print("\nsample missing (non-promoted clubs):",
      [f"{n} ({t}/{p})" for n, t, p in api_only if t not in ("Coventry", "Hull", "Ipswich")][:15])
db.close()

"""One-off: add notable last-season scorers missing from our seeded squads.

/players/squads (the seed's roster source) omits some players entirely
(Lewandowski, Griezmann, ...). This finds top-100 2024-25 scorers whose
surname isn't in our pool for that competition, resolves each via
/players?team=<club>&season=2024&search=<name> (numeric id + position +
goals), and adds them priced from their goal output.

CANNOT verify a player's current 2026-27 club on the free tier, so the DRY
RUN lists every candidate with club + goals for you to eyeball — most
Bundesliga misses are genuine transfers away and should be skipped. Pass
specific external ids to --skip, or --apply to add everything shown.

Run from Sporty_Backend/: PYTHONPATH=. venv/bin/python scripts/backfill_missing_scorers.py
"""
import json
import os
import sys
import time
import unicodedata
from decimal import Decimal
from pathlib import Path

import httpx

import app.main  # noqa: F401
from app.database import SessionLocal
from app.league.models import Sport
from app.player.models import Player, RealTeam

CACHE = Path(os.environ.get("EPL_SYNC_CACHE", "/tmp/epl_api_cache"))
KEY = next(l.split("=", 1)[1].strip() for l in open(".env") if l.startswith("FOOTBALL_API_KEY="))
APPLY = "--apply" in sys.argv
SKIP = {a for a in sys.argv if a.isdigit()}  # external ids to skip
MIN_GOALS = 8  # only surface players worth adding; fringe stays out

SIGNAL_SEASON = 2024
COMP_CODES = {"EPL": "PL", "LALIGA": "PD", "BUNDESLIGA": "BL1"}
POS_MAP = {"Goalkeeper": "GKP", "Defender": "DEF", "Midfielder": "MID", "Attacker": "FWD"}

# API-Football team id -> name, per competition (from seed_league_squads).
CLUB_IDS = {
    "LALIGA": {531: "Athletic Club", 727: "Osasuna", 530: "Atletico Madrid", 542: "Alaves",
               797: "Elche", 529: "Barcelona", 546: "Getafe", 539: "Levante", 535: "Malaga",
               538: "Celta Vigo", 544: "Deportivo La Coruna", 540: "Espanyol", 728: "Rayo Vallecano",
               543: "Real Betis", 541: "Real Madrid", 4665: "Racing Santander", 548: "Real Sociedad",
               536: "Sevilla", 532: "Valencia", 533: "Villarreal"},
    "BUNDESLIGA": {192: "1. FC Köln", 182: "Union Berlin", 164: "FSV Mainz 05", 168: "Bayer Leverkusen",
                   165: "Borussia Dortmund", 163: "Borussia Mönchengladbach", 169: "Eintracht Frankfurt",
                   170: "FC Augsburg", 157: "Bayern München", 174: "FC Schalke 04", 175: "Hamburger SV",
                   173: "RB Leipzig", 160: "SC Freiburg", 185: "SC Paderborn 07", 1660: "SV Elversberg",
                   162: "Werder Bremen", 167: "1899 Hoffenheim", 172: "VfB Stuttgart"},
    "EPL": {33: "Manchester United", 34: "Newcastle United", 35: "Bournemouth", 36: "Fulham",
            40: "Liverpool", 42: "Arsenal", 45: "Everton", 47: "Tottenham Hotspur", 49: "Chelsea",
            50: "Manchester City", 51: "Brighton &amp; Hove Albion", 52: "Crystal Palace", 55: "Brentford",
            57: "Ipswich Town", 65: "Nottingham Forest", 66: "Aston Villa", 63: "Leeds United",
            746: "Sunderland", 1346: "Coventry City", 64: "Hull City"},
}

_FACTOR = Decimal("0.058")
MIN_COST, MAX_COST = Decimal("4.0"), Decimal("15.0")


def fold(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    return "".join(c for c in s if not unicodedata.combining(c)).lower().strip()


def _round_half(c: Decimal) -> Decimal:
    return (c * 2).quantize(Decimal("1")) / 2


def cost_from(goals: int, assists: int) -> Decimal:
    return _round_half(max(MIN_COST, min(MAX_COST, MIN_COST + (Decimal(goals) * 5 + Decimal(assists) * 3) * _FACTOR)))


def af_get(name: str, params: dict) -> dict:
    f = CACHE / f"{name}.json"
    if f.exists():
        return json.loads(f.read_text())
    time.sleep(6.5)
    r = httpx.get("https://v3.football.api-sports.io/players", params=params,
                  headers={"x-apisports-key": KEY}, timeout=30)
    r.raise_for_status()
    d = r.json()
    f.write_text(json.dumps(d))
    return d


def fetch_image(url: str):
    try:
        r = httpx.get(url, timeout=30, follow_redirects=True)
        r.raise_for_status()
        ct = r.headers.get("content-type", "image/png").split(";")[0]
        ext = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}.get(ct, "png")
        return r.content, ct, ext
    except Exception:
        return None


db = SessionLocal()
fb = db.query(Sport).filter(Sport.name == "football").first()
by_ext = {p.external_api_id for p in db.query(Player).filter(Player.sport_id == fb.id) if (p.external_api_id or "").isdigit()}

candidates = []
for comp, code in COMP_CODES.items():
    scorers = json.loads((CACHE / f"fdo_scorers_{code}_{SIGNAL_SEASON}.json").read_text()).get("scorers", [])
    our_surnames = {
        fold(p.name).split()[-1]
        for (p,) in [(x,) for x in db.query(Player).join(RealTeam, Player.real_team_id == RealTeam.id)
                     .filter(RealTeam.competition == comp).all()]
    }
    id_by_foldname = {fold(v): k for k, v in CLUB_IDS[comp].items()}

    for s in scorers:
        goals = s.get("goals") or 0
        if goals < MIN_GOALS:
            continue
        surname = fold(s["player"]["name"]).split()[-1]
        if surname in our_surnames:
            continue
        # Map the scorer's (2024-25) club to one of our current clubs.
        team_fold = fold(s["team"]["name"])
        club_id = next(
            (cid for fname, cid in id_by_foldname.items()
             if fname in team_fold or team_fold in fname
             or fname.split()[-1] == team_fold.split()[-1]),
            None,
        )
        if club_id is None:
            continue  # 2024-25 club not in our current competition
        candidates.append((comp, s["player"]["name"], surname, s["team"]["name"],
                           club_id, goals, s.get("assists") or 0))

added, skipped = [], []
for comp, name, surname, team_name, club_id, goals, assists in candidates:
    key = f"resolve_{club_id}_{surname}"
    d = af_get(key, {"team": club_id, "season": SIGNAL_SEASON, "search": surname})
    resp = d.get("response") or []
    if not resp:
        skipped.append((name, team_name, "not found in team roster"))
        continue
    entry = resp[0]
    api_id = str(entry["player"]["id"])
    if api_id in by_ext or api_id in SKIP:
        skipped.append((name, team_name, "already in DB or skipped"))
        continue
    st = entry["statistics"][0]
    pos = POS_MAP.get(st["games"].get("position"), "FWD")
    comp_club_name = CLUB_IDS[comp][club_id]
    team_row = db.query(RealTeam).filter(RealTeam.sport_id == fb.id, RealTeam.name == comp_club_name).first()
    if team_row is None:
        skipped.append((name, team_name, f"club {comp_club_name} not seeded"))
        continue
    cost = cost_from(goals, assists)
    added.append((comp, entry["player"]["name"], api_id, pos, comp_club_name, cost, goals, assists,
                  entry["player"].get("photo"), team_row))
    by_ext.add(api_id)

if APPLY:
    for comp, name, api_id, pos, club, cost, g, a, photo, team_row in added:
        player = Player(sport_id=fb.id, external_api_id=api_id, name=name, position=pos,
                        real_team=club, real_team_id=team_row.id, cost=cost, is_available=True)
        db.add(player)
        db.flush()
        if photo:
            img = fetch_image(photo)
            if img:
                from app.services.storage_service import upload_player_photo
                player.photo_url = upload_player_photo(player.id, *img)
            time.sleep(0.15)
    db.commit()
    print("\n*** COMMITTED ***")
else:
    db.rollback()
    print("\n*** DRY RUN (no writes) — review, then --apply (or pass ids to --skip) ***")

print(f"\ncandidates surfaced: {len(candidates)} | would add: {len(added)} | skipped: {len(skipped)}")
print("\nWOULD ADD (review for transfers — their listed club is their 2024-25 club):")
for comp, name, api_id, pos, club, cost, g, a, *_ in sorted(added, key=lambda x: -x[5]):
    print(f"  {float(cost):>5}  id={api_id:<7} {name:<26} {pos:<4} {club:<22} ({g}g {a}a)  [{comp}]")
if skipped:
    print("\nskipped:")
    for name, team, why in skipped[:20]:
        print(f"  {name:<26} {team:<24} — {why}")
db.close()

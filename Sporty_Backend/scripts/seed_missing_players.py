"""One-off (applied to prod 2026-07-24): seed missing 2026-27 EPL players +
promoted-club RealTeams (Coventry/Ipswich/Hull) + R2-hosted club logos and
player photos. Idempotent; dry run by default; --apply commits.
Run from Sporty_Backend/: PYTHONPATH=. venv/bin/python scripts/seed_missing_players.py
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
CACHE.mkdir(parents=True, exist_ok=True)
KEY = next(l.split("=", 1)[1].strip() for l in open(".env") if l.startswith("FOOTBALL_API_KEY="))
APPLY = "--apply" in sys.argv

# (api_team_id, db RealTeam name, ext slug for new teams)
CLUBS = [
    (33, "Manchester United"), (34, "Newcastle United"), (35, "Bournemouth"),
    (36, "Fulham"), (40, "Liverpool"), (42, "Arsenal"), (45, "Everton"),
    (47, "Tottenham Hotspur"), (49, "Chelsea"), (50, "Manchester City"),
    (51, "Brighton &amp; Hove Albion"), (52, "Crystal Palace"), (55, "Brentford"),
    (57, "Ipswich Town"), (65, "Nottingham Forest"), (66, "Aston Villa"),
    (63, "Leeds United"), (746, "Sunderland"), (1346, "Coventry City"),
    (64, "Hull City"),
]
NEW_CLUBS = {57: ("Ipswich Town", "football:ipswich_town"),
             1346: ("Coventry City", "football:coventry_city"),
             64: ("Hull City", "football:hull_city")}
# existing clubs missing a logo -> api id (Burnley resolved via cached search)
LOGO_BACKFILL = {"Leeds United": 63, "Sunderland": 746}
POS_MAP = {"Goalkeeper": "GKP", "Defender": "DEF", "Midfielder": "MID", "Attacker": "FWD"}


def api_get(name: str, path: str, params: dict) -> dict:
    f = CACHE / f"{name}.json"
    if f.exists():
        return json.loads(f.read_text())
    time.sleep(6.5)
    r = httpx.get(f"https://v3.football.api-sports.io/{path}", params=params,
                  headers={"x-apisports-key": KEY}, timeout=30)
    r.raise_for_status()
    d = r.json()
    if d.get("errors"):
        raise RuntimeError(f"{name}: {d['errors']}")
    f.write_text(json.dumps(d))
    return d


def fold(s: str) -> str:
    s = unicodedata.normalize("NFKD", s)
    return "".join(c for c in s if not unicodedata.combining(c)).lower().strip()


def fetch_image(url: str) -> tuple[bytes, str, str] | None:
    try:
        r = httpx.get(url, timeout=30, follow_redirects=True)
        r.raise_for_status()
        ct = r.headers.get("content-type", "image/png").split(";")[0]
        ext = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}.get(ct, "png")
        return r.content, ct, ext
    except Exception as exc:  # noqa: BLE001
        print(f"    image fetch failed ({url}): {exc}")
        return None


# Burnley id via search (1 request, then cached)
burnley = api_get("search_Burnley", "teams", {"search": "Burnley"})
b_hits = [(t["team"]["id"], t["team"]["name"]) for t in burnley["response"]
          if t["team"].get("country") == "England" and t["team"]["name"] == "Burnley"]
if b_hits:
    LOGO_BACKFILL["Burnley"] = b_hits[0][0]
print("Burnley id:", b_hits)

db = SessionLocal()
fb = db.query(Sport).filter(Sport.name == "football").first()
real_teams = {t.name: t for t in db.query(RealTeam).filter(RealTeam.sport_id == fb.id).all()}

# ── 1. RealTeams for promoted clubs ─────────────────────────────────────────
created_teams = []
for tid, (db_name, slug) in NEW_CLUBS.items():
    if db_name in real_teams:
        continue
    team = RealTeam(sport_id=fb.id, name=db_name, external_api_id=slug)
    db.add(team)
    db.flush()
    real_teams[db_name] = team
    created_teams.append(db_name)
    if APPLY:
        img = fetch_image(f"https://media.api-sports.io/football/teams/{tid}.png")
        if img:
            from app.services.storage_service import upload_team_logo
            team.logo_url = upload_team_logo(team.id, *img)

# ── 2. Logo backfill for existing clubs ─────────────────────────────────────
logos_backfilled = []
for db_name, tid in LOGO_BACKFILL.items():
    team = real_teams.get(db_name)
    if team is None or team.logo_url:
        continue
    logos_backfilled.append(db_name)
    if APPLY:
        img = fetch_image(f"https://media.api-sports.io/football/teams/{tid}.png")
        if img:
            from app.services.storage_service import upload_team_logo
            team.logo_url = upload_team_logo(team.id, *img)

# ── 3. Players ──────────────────────────────────────────────────────────────
players = db.query(Player).filter(Player.sport_id == fb.id).all()
by_ext = {p.external_api_id: p for p in players if p.external_api_id}
unmatched = [p for p in players if not (p.external_api_id or "").isdigit()
             and p.real_team != "Sub Test Town"]

relinked, created, skipped_existing = [], [], 0
for tid, db_name in CLUBS:
    d = api_get(f"squad_{tid}", "players/squads", {"team": tid})
    squad = d["response"][0]["players"] if d["response"] else []
    team_row = real_teams[db_name]
    for sp in squad:
        api_id, name = str(sp["id"]), sp["name"]
        pos = POS_MAP.get(sp.get("position"), "MID")
        if api_id in by_ext:
            skipped_existing += 1
            continue

        # Relink pass: initial-form / single-token match against still-slug
        # players, position must agree, match must be unique.
        fname = fold(name)
        tokens = fname.split()
        cands = []
        for p in unmatched:
            ptoks = fold(p.name).split()
            if p.position != pos or not ptoks:
                continue
            if fold(p.name) == fname:
                cands.append(p)
            elif (len(tokens) > 1 and len(tokens[0].rstrip(".")) <= 2
                  and ptoks[-1] == tokens[-1] and ptoks[0][0] == tokens[0][0]):
                cands.append(p)
            elif len(tokens) == 1 and tokens[0] in ptoks:
                cands.append(p)
        if len(cands) == 1:
            p = cands[0]
            relinked.append((p.name, p.real_team, "->", name, db_name))
            p.external_api_id = api_id
            p.real_team = db_name
            p.real_team_id = team_row.id
            by_ext[api_id] = p
            unmatched.remove(p)
            continue

        # Create
        player = Player(
            sport_id=fb.id, external_api_id=api_id, name=name, position=pos,
            real_team=db_name, real_team_id=team_row.id,
            cost=Decimal("4.0"), is_available=True,
        )
        db.add(player)
        db.flush()
        created.append((name, db_name, pos))
        by_ext[api_id] = player
        if APPLY and sp.get("photo"):
            img = fetch_image(sp["photo"])
            if img:
                from app.services.storage_service import upload_player_photo
                player.photo_url = upload_player_photo(player.id, *img)
            time.sleep(0.15)

if APPLY:
    from scripts.backfill_player_team_images import sync_player_team_logos
    sync_player_team_logos(db)  # denormalise team logo onto players
    db.commit()
    print("\n*** COMMITTED ***")
else:
    db.rollback()
    print("\n*** DRY RUN (no writes, no uploads) ***")

print(f"\nnew RealTeams: {created_teams}")
print(f"logos backfilled: {logos_backfilled}")
print(f"already linked (skipped): {skipped_existing}")
print(f"relinked cross-club/initial-form: {len(relinked)}")
for r in relinked:
    print("  ", *r)
print(f"created players: {len(created)}")
from collections import Counter
print("  per club:", dict(Counter(c for _, c, _ in created)))
print("  per pos:", dict(Counter(p for _, _, p in created)))
db.close()

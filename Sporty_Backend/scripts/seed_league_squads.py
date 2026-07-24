"""Seed La Liga + Bundesliga squads (2026-27) and tag RealTeam.competition.

One-off companion to seed_missing_players.py (EPL). For each club: RealTeam
row (competition tag + R2-hosted logo) and its current squad from
API-Football /players/squads (pool-minimum cost 4.0, R2-hosted photos).
Also backfills competition="EPL" on the existing Premier League clubs.
Idempotent: existing teams/players (by name / numeric external id) are
skipped. Dry run by default; --apply commits and uploads.

Run from Sporty_Backend/: PYTHONPATH=. venv/bin/python scripts/seed_league_squads.py --apply
"""
import json
import os
import sys
import time
import unicodedata
from decimal import Decimal
from pathlib import Path

import httpx

import app.main  # noqa: F401  — registers all model modules
from app.database import SessionLocal
from app.league.models import Sport
from app.player.models import Player, RealTeam

CACHE = Path(os.environ.get("EPL_SYNC_CACHE", "/tmp/epl_api_cache"))
CACHE.mkdir(parents=True, exist_ok=True)
KEY = next(l.split("=", 1)[1].strip() for l in open(".env") if l.startswith("FOOTBALL_API_KEY="))
APPLY = "--apply" in sys.argv

# (api_team_id, API-Football name) — ids resolved live 2026-07-24.
LALIGA = [
    (531, "Athletic Club"), (727, "Osasuna"), (530, "Atletico Madrid"),
    (542, "Alaves"), (797, "Elche"), (529, "Barcelona"), (546, "Getafe"),
    (539, "Levante"), (535, "Malaga"), (538, "Celta Vigo"),
    (544, "Deportivo La Coruna"), (540, "Espanyol"), (728, "Rayo Vallecano"),
    (543, "Real Betis"), (541, "Real Madrid"), (4665, "Racing Santander"),
    (548, "Real Sociedad"), (536, "Sevilla"), (532, "Valencia"), (533, "Villarreal"),
]
BUNDESLIGA = [
    (192, "1. FC Köln"), (182, "Union Berlin"), (164, "FSV Mainz 05"),
    (168, "Bayer Leverkusen"), (165, "Borussia Dortmund"),
    (163, "Borussia Mönchengladbach"), (169, "Eintracht Frankfurt"),
    (170, "FC Augsburg"), (157, "Bayern München"), (174, "FC Schalke 04"),
    (175, "Hamburger SV"), (173, "RB Leipzig"), (160, "SC Freiburg"),
    (185, "SC Paderborn 07"), (1660, "SV Elversberg"), (162, "Werder Bremen"),
    (167, "1899 Hoffenheim"), (172, "VfB Stuttgart"),
]
EPL_DB_NAMES = [
    "Manchester United", "Newcastle United", "Bournemouth", "Fulham",
    "Liverpool", "Arsenal", "Everton", "Tottenham Hotspur", "Chelsea",
    "Manchester City", "Brighton &amp; Hove Albion", "Crystal Palace",
    "Brentford", "Ipswich Town", "Nottingham Forest", "Aston Villa",
    "Leeds United", "Sunderland", "Coventry City", "Hull City",
]
POS_MAP = {"Goalkeeper": "GKP", "Defender": "DEF", "Midfielder": "MID", "Attacker": "FWD"}


def api_get(name: str, path: str, params: dict) -> dict:
    f = CACHE / f"{name}.json"
    if f.exists():
        return json.loads(f.read_text())
    time.sleep(6.5)  # free tier: 10 req/min
    r = httpx.get(f"https://v3.football.api-sports.io/{path}", params=params,
                  headers={"x-apisports-key": KEY}, timeout=30)
    r.raise_for_status()
    d = r.json()
    if d.get("errors"):
        raise RuntimeError(f"{name}: {d['errors']}")
    f.write_text(json.dumps(d))
    return d


def slug(name: str) -> str:
    s = unicodedata.normalize("NFKD", name)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    return "football:" + "".join(c if c.isalnum() else "_" for c in s).strip("_")


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


db = SessionLocal()
fb = db.query(Sport).filter(Sport.name == "football").first()
by_ext = {
    p.external_api_id for p in db.query(Player).filter(Player.sport_id == fb.id)
    if (p.external_api_id or "").isdigit()
}

# ── EPL competition-tag backfill ────────────────────────────────────────────
tagged = 0
for name in EPL_DB_NAMES:
    team = db.query(RealTeam).filter(RealTeam.sport_id == fb.id, RealTeam.name == name).first()
    if team is not None and team.competition != "EPL":
        team.competition = "EPL"
        tagged += 1
print(f"EPL clubs tagged: {tagged}")

created_teams, created_players = [], []
for comp_tag, clubs in (("LALIGA", LALIGA), ("BUNDESLIGA", BUNDESLIGA)):
    for tid, af_name in clubs:
        team = db.query(RealTeam).filter(RealTeam.sport_id == fb.id, RealTeam.name == af_name).first()
        if team is None:
            team = RealTeam(sport_id=fb.id, name=af_name, external_api_id=slug(af_name),
                            competition=comp_tag)
            db.add(team)
            db.flush()
            created_teams.append(af_name)
            if APPLY:
                img = fetch_image(f"https://media.api-sports.io/football/teams/{tid}.png")
                if img:
                    from app.services.storage_service import upload_team_logo
                    team.logo_url = upload_team_logo(team.id, *img)
        elif team.competition != comp_tag:
            team.competition = comp_tag

        d = api_get(f"squad_{tid}", "players/squads", {"team": tid})
        squad = d["response"][0]["players"] if d["response"] else []
        for sp in squad:
            api_id, name = str(sp["id"]), sp["name"]
            if api_id in by_ext:
                continue
            player = Player(
                sport_id=fb.id, external_api_id=api_id, name=name,
                position=POS_MAP.get(sp.get("position"), "MID"),
                real_team=af_name, real_team_id=team.id,
                cost=Decimal("4.0"), is_available=True,
            )
            db.add(player)
            db.flush()
            created_players.append((name, af_name))
            by_ext.add(api_id)
            if APPLY and sp.get("photo"):
                img = fetch_image(sp["photo"])
                if img:
                    from app.services.storage_service import upload_player_photo
                    player.photo_url = upload_player_photo(player.id, *img)
                time.sleep(0.15)

if APPLY:
    from scripts.backfill_player_team_images import sync_player_team_logos
    sync_player_team_logos(db)
    db.commit()
    print("\n*** COMMITTED ***")
else:
    db.rollback()
    print("\n*** DRY RUN (no writes, no uploads) ***")

from collections import Counter
print(f"teams created: {len(created_teams)}: {created_teams}")
print(f"players created: {len(created_players)}")
print("per club:", dict(Counter(t for _, t in created_players)))
db.close()

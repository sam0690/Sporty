"""One-time backfill for player photos and real-team logos.

Basketball: our seeded rows already carry real NBA.com IDs
(external_api_id = "nba:<id>"), so photo/logo URLs are constructed
directly from NBA's public CDN — no API call needed.

Football: no such linkage exists (the CSV's own IDs were discarded
during seeding), so team logos are fetched once from API-Football by
name match and re-hosted in our own R2 bucket. Football player photos
are intentionally left as-is — the frontend falls back to a
placeholder for players with no photo_url.

Run manually:
    venv/bin/python scripts/backfill_player_team_images.py
"""
import asyncio
import html
import re

import httpx
from sqlalchemy import text

import app.main  # noqa: F401 — registers all model modules so relationships resolve

from app.database import SessionLocal
from app.external_apis.football_api import FootballAPIClient
from app.league.models import Sport
from app.player.models import Player, RealTeam
from app.services.storage_service import upload_team_logo

NBA_HEADSHOT_URL = "https://cdn.nba.com/headshots/nba/latest/1040x760/{id}.png"
NBA_LOGO_URL = "https://cdn.nba.com/logos/nba/{id}/global/L/logo.svg"

# API-Football's free tier only serves seasons 2022-2024, so newly
# promoted 2025-26 clubs (Leeds United, Burnley, Sunderland) aren't
# reachable here and are left unmatched.
FOOTBALL_TEAM_NAME_MAP = {
    "arsenal": "Arsenal",
    "aston villa": "Aston Villa",
    "bournemouth": "Bournemouth",
    "brentford": "Brentford",
    "brighton hove albion": "Brighton",
    "chelsea": "Chelsea",
    "crystal palace": "Crystal Palace",
    "everton": "Everton",
    "fulham": "Fulham",
    "liverpool": "Liverpool",
    "liverpool fc": "Liverpool",
    "manchester city": "Manchester City",
    "manchester united": "Manchester United",
    "newcastle united": "Newcastle",
    "nottingham forest": "Nottingham Forest",
    "tottenham hotspur": "Tottenham",
    "west ham united": "West Ham",
    "wolverhampton": "Wolves",
}


def _normalize(name: str) -> str:
    name = html.unescape(name)
    name = re.sub(r"[^a-z0-9 ]", "", name.lower())
    return re.sub(r"\s+", " ", name).strip()


def backfill_basketball(db) -> None:
    players = db.query(Player).filter(Player.external_api_id.like("nba:%")).all()
    for player in players:
        nba_id = player.external_api_id.split(":", 1)[1]
        player.photo_url = NBA_HEADSHOT_URL.format(id=nba_id)

    teams = db.query(RealTeam).filter(RealTeam.external_api_id.like("nba:%")).all()
    for team in teams:
        nba_id = team.external_api_id.split(":", 1)[1]
        team.logo_url = NBA_LOGO_URL.format(id=nba_id)

    db.commit()
    print(f"Basketball: set photo_url for {len(players)} players, logo_url for {len(teams)} teams")


async def backfill_football_team_logos(db) -> None:
    client = FootballAPIClient()
    data = await client.get_teams(league_id=39, season=2024)
    api_teams_by_name = {t["team"]["name"]: t["team"] for t in data["response"]}

    sport = db.query(Sport).filter(Sport.name == "football").first()
    if sport is None:
        print("Football: no 'football' sport row found, skipping")
        return

    teams = db.query(RealTeam).filter(RealTeam.sport_id == sport.id).all()

    matched: list[str] = []
    unmatched: list[str] = []

    async with httpx.AsyncClient() as http_client:
        for team in teams:
            api_name = FOOTBALL_TEAM_NAME_MAP.get(_normalize(team.name))
            api_team = api_teams_by_name.get(api_name) if api_name else None
            if not api_team:
                unmatched.append(team.name)
                continue

            resp = await http_client.get(api_team["logo"], timeout=30)
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "image/png").split(";")[0]
            extension = content_type.split("/")[-1]

            team.logo_url = upload_team_logo(team.id, resp.content, content_type, extension)
            matched.append(team.name)

    db.commit()
    print(f"Football: uploaded logos for {len(matched)} teams: {matched}")
    print(f"Football: unmatched, left NULL for {len(unmatched)} teams: {unmatched}")


def sync_player_team_logos(db) -> None:
    """Copy each player's real team logo onto Player.real_team_logo_url.

    Denormalised on purpose (see the comment on the column in
    app/player/models.py) — avoids joinedload(Player.real_team_ref) at
    every existing query site that eager-loads Player.sport. Re-run this
    after any team logo changes.
    """
    result = db.execute(text("""
        UPDATE players p SET real_team_logo_url = rt.logo_url
        FROM real_teams rt WHERE p.real_team_id = rt.id AND rt.logo_url IS NOT NULL
    """))
    db.commit()
    print(f"Synced real_team_logo_url onto {result.rowcount} players")


def main() -> None:
    db = SessionLocal()
    try:
        backfill_basketball(db)
        asyncio.run(backfill_football_team_logos(db))
        sync_player_team_logos(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()

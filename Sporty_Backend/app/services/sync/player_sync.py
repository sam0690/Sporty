"""
Player sync service — Fetch and sync players from external APIs.

Syncs player data from:
  - API-Football (football/soccer)
  - API-NBA (basketball)
  - CricAPI (cricket)

Usage:
    from app.services.sync.player_sync import sync_football_players
    
    db = SessionLocal()
    await sync_football_players(db, league_id=39, season=2024)
"""

import asyncio
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.redis import cache_delete
from app.external_apis.cricket_api import CricketAPIClient
from app.external_apis.football_api import FootballAPIClient
from app.league.models import Sport
from app.player.models import Player, RealTeam


def _ensure_real_team(db: Session, sport_id, team_name: str, external_api_id: str | None = None) -> RealTeam:
    team_name = team_name.strip() or "Unknown"
    team = (
        db.query(RealTeam)
        .filter(RealTeam.sport_id == sport_id, RealTeam.name == team_name)
        .first()
    )
    if team:
        if external_api_id and not team.external_api_id:
            team.external_api_id = external_api_id
        return team

    team = RealTeam(
        sport_id=sport_id,
        external_api_id=external_api_id,
        name=team_name,
    )
    db.add(team)
    db.flush()
    return team


def _nba_season_string(season: int | str | None = None) -> str:
    if season is None:
        today = date.today()
        start_year = today.year if today.month >= 7 else today.year - 1
        return f"{start_year}-{str(start_year + 1)[-2:]}"

    if isinstance(season, int):
        return f"{season}-{str(season + 1)[-2:]}"

    season_value = season.strip()
    if "-" in season_value:
        return season_value

    start_year = int(season_value)
    return f"{start_year}-{str(start_year + 1)[-2:]}"


def _clear_basketball_catalog(db: Session, sport_id) -> tuple[int, int]:
    deleted_players = (
        db.query(Player)
        .filter(Player.sport_id == sport_id)
        .delete(synchronize_session=False)
    )
    deleted_teams = (
        db.query(RealTeam)
        .filter(RealTeam.sport_id == sport_id)
        .delete(synchronize_session=False)
    )
    return deleted_players, deleted_teams


def _split_player_name(full_name: str) -> tuple[str, str]:
    parts = full_name.strip().split(" ", 1)
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], parts[1]


def _upsert_real_team(
    db: Session,
    *,
    sport_id,
    external_api_id: str,
    name: str,
    abbreviation: str | None = None,
    city: str | None = None,
    conference: str | None = None,
    division: str | None = None,
) -> RealTeam:
    team = (
        db.query(RealTeam)
        .filter(
            RealTeam.sport_id == sport_id,
            RealTeam.external_api_id == external_api_id,
        )
        .first()
    )
    if team is None:
        team = RealTeam(
            sport_id=sport_id,
            external_api_id=external_api_id,
            name=name,
            abbreviation=abbreviation,
            city=city,
            conference=conference,
            division=division,
        )
        db.add(team)
    else:
        team.name = name
        team.abbreviation = abbreviation
        team.city = city
        team.conference = conference
        team.division = division
    return team


async def sync_football_players(
    db: Session, league_id: int = 39, season: int = 2024
):
    """
    Fetch and sync football players from API-Football.

    Args:
        db: Database session
        league_id: League ID (39 = Premier League, 140 = La Liga)
        season: Year (e.g., 2024)
    """
    print(f"⚽ Syncing football players (League {league_id}, Season {season})...")

    # Get sport
    football = db.query(Sport).filter(Sport.name == "football").first()
    if not football:
        print("❌ Football sport not found in database. Create it first.")
        return

    # Fetch from API
    client = FootballAPIClient()

    # API-Football paginates results (20 players per page)
    page = 1
    total_added = 0
    total_updated = 0

    while True:
        try:
            response = await client.get_players(
                league_id=league_id, season=season, page=page
            )

            players_data = response.get("response", [])
            if not players_data:
                break  # No more pages

            for item in players_data:
                player_info = item.get("player", {})
                stats_list = item.get("statistics", [])

                if not stats_list:
                    continue

                stats = stats_list[0]  # Take first team stats

                player_id = player_info.get("id")
                name = player_info.get("name")
                photo = player_info.get("photo")
                position = stats.get("games", {}).get("position", "Unknown")
                team = stats.get("team", {}).get("name", "Unknown")

                team_row = _ensure_real_team(db, football.id, team)

                if not player_id or not name:
                    continue

                # Check if exists
                existing = (
                    db.query(Player)
                    .filter(Player.external_api_id == str(player_id))
                    .first()
                )

                if existing:
                    # Update existing
                    existing.name = name
                    existing.real_team = team
                    existing.real_team_id = team_row.id
                    existing.position = position
                    existing.is_available = True
                    existing.photo_url = photo or existing.photo_url
                    total_updated += 1
                    print(f"  ♻️  Updated: {name} ({team})")
                else:
                    # Create new
                    player = Player(
                        sport_id=football.id,
                        external_api_id=str(player_id),
                        name=name,
                        photo_url=photo,
                        real_team=team,
                        real_team_id=team_row.id,
                        position=position,
                        cost=Decimal("7.0"),  # Default cost
                        is_available=True,
                    )
                    db.add(player)
                    total_added += 1
                    print(f"  ✅ Added: {name} ({team})")

            db.commit()

            # Check if there are more pages
            paging = response.get("paging", {})
            if page >= paging.get("total", 1):
                break

            page += 1

        except Exception as e:
            print(f"❌ Error syncing page {page}: {e}")
            db.rollback()
            break

    print(
        f"✅ Football players synced! Added: {total_added}, Updated: {total_updated}"
    )
    cache_delete("players:football")


async def sync_basketball_players(db: Session, season: int | str | None = None):
    """
    Fetch and sync basketball teams and players from nba_api.

    Args:
        db: Database session
        season: NBA season start year or season string. Defaults to the current season.
    """
    nba_season = _nba_season_string(season)
    print(f"🏀 Syncing basketball teams and players (Season {nba_season})...")

    # Get sport
    basketball = db.query(Sport).filter(Sport.name == "basketball").first()
    if not basketball:
        print("❌ Basketball sport not found in database. Create it first.")
        return

    deleted_players, deleted_teams = _clear_basketball_catalog(db, basketball.id)
    print(f"  🧹 Cleared {deleted_players} players and {deleted_teams} teams for basketball")

    from nba_api.stats.endpoints import commonteamroster
    from nba_api.stats.static import teams as nba_teams

    total_teams = 0
    total_players = 0

    try:
        nba_team_rows = nba_teams.get_teams()
        team_map: dict[str, RealTeam] = {}

        for team_info in nba_team_rows:
            external_api_id = str(team_info.get("id", ""))
            full_name = str(team_info.get("full_name", "") or "").strip()
            if not external_api_id or not full_name:
                continue

            team = _upsert_real_team(
                db,
                sport_id=basketball.id,
                external_api_id=external_api_id,
                name=full_name,
                abbreviation=team_info.get("abbreviation"),
                city=team_info.get("city"),
            )
            team_map[external_api_id] = team
            total_teams += 1

        db.flush()

        for team_info in nba_team_rows:
            external_api_id = str(team_info.get("id", ""))
            team = team_map.get(external_api_id)
            if team is None:
                continue

            roster = commonteamroster.CommonTeamRoster(
                team_id=external_api_id,
                season=nba_season,
            )
            roster_rows = roster.get_data_frames()[0].to_dict("records")

            for player_info in roster_rows:
                player_id = player_info.get("PLAYER_ID")
                full_name = str(player_info.get("PLAYER", "") or "").strip()
                if not player_id or not full_name:
                    continue

                position = str(player_info.get("POSITION", "") or "Unknown").strip() or "Unknown"
                existing = (
                    db.query(Player)
                    .filter(Player.external_api_id == str(player_id))
                    .first()
                )

                if existing:
                    existing.name = full_name
                    existing.position = position
                    existing.real_team = team.name
                    existing.real_team_id = team.id
                    existing.is_available = True
                    total_players += 1
                else:
                    first_name, last_name = _split_player_name(full_name)
                    db.add(
                        Player(
                            sport_id=basketball.id,
                            external_api_id=str(player_id),
                            name=full_name,
                            position=position,
                            real_team=team.name,
                            real_team_id=team.id,
                            cost=Decimal("0.0"),
                            is_available=True,
                        )
                    )
                    _ = (first_name, last_name)
                    total_players += 1

        db.commit()
        print(
            f"✅ Basketball ingest complete! Inserted/updated {total_teams} teams and {total_players} players"
        )
        cache_delete("players:basketball")

    except Exception as e:
        print(f"❌ Error syncing basketball players and teams: {e}")
        db.rollback()


async def sync_cricket_players(db: Session):
    """
    Fetch and sync cricket players from CricAPI.

    Note: CricAPI doesn't have a bulk players endpoint.
    Players are typically discovered through match scorecards.
    This is a placeholder for future implementation.
    """
    print("🏏 Cricket player sync not yet implemented.")
    print("   Cricket players are typically synced from match scorecards.")

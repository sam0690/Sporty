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
from decimal import Decimal

from sqlalchemy.orm import Session

from app.external_apis.basketball_api import BasketballAPIClient
from app.external_apis.cricket_api import CricketAPIClient
from app.external_apis.football_api import FootballAPIClient
from app.league.models import Sport
from app.player.models import Player


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
                position = stats.get("games", {}).get("position", "Unknown")
                team = stats.get("team", {}).get("name", "Unknown")

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
                    existing.position = position
                    existing.is_available = True
                    total_updated += 1
                    print(f"  ♻️  Updated: {name} ({team})")
                else:
                    # Create new
                    player = Player(
                        sport_id=football.id,
                        external_api_id=str(player_id),
                        name=name,
                        real_team=team,
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


async def sync_basketball_players(db: Session, season: int = 2024):
    """
    Fetch and sync basketball players from API-NBA.

    Args:
        db: Database session
        season: Year (e.g., 2024)
    """
    print(f"🏀 Syncing basketball players (Season {season})...")

    # Get sport
    basketball = db.query(Sport).filter(Sport.name == "basketball").first()
    if not basketball:
        print("❌ Basketball sport not found in database. Create it first.")
        return

    # Fetch from API
    client = BasketballAPIClient()
    total_added = 0
    total_updated = 0

    try:
        response = await client.get_players(season=season)
        players_data = response.get("response", [])

        for player_info in players_data:
            player_id = player_info.get("id")
            firstname = player_info.get("firstname", "")
            lastname = player_info.get("lastname", "")
            name = f"{firstname} {lastname}".strip()

            # NBA API doesn't provide position directly in players endpoint
            # This would need to be fetched from team rosters or game stats
            position = "Unknown"

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
                existing.is_available = True
                total_updated += 1
                print(f"  ♻️  Updated: {name}")
            else:
                # Create new
                player = Player(
                    sport_id=basketball.id,
                    external_api_id=str(player_id),
                    name=name,
                    real_team="Unknown",  # Would need additional API call
                    position=position,
                    cost=Decimal("8.0"),
                    is_available=True,
                )
                db.add(player)
                total_added += 1
                print(f"  ✅ Added: {name}")

        db.commit()
        print(
            f"✅ Basketball players synced! Added: {total_added}, Updated: {total_updated}"
        )

    except Exception as e:
        print(f"❌ Error syncing basketball players: {e}")
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

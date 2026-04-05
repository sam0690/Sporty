"""
Match sync service — Fetch and sync matches/fixtures from external APIs.

Syncs match data from:
  - API-Football (football/soccer)
  - API-NBA (basketball)
  - CricAPI (cricket)

Usage:
    from app.services.sync.match_sync import sync_football_matches
    
    db = SessionLocal()
    await sync_football_matches(db, league_id=39, season=2024)
"""

import asyncio
from datetime import datetime

from sqlalchemy.orm import Session

from app.external_apis.basketball_api import BasketballAPIClient
from app.external_apis.cricket_api import CricketAPIClient
from app.external_apis.football_api import FootballAPIClient
from app.league.models import Sport
from app.match.models import Match
from app.services.scoring.trigger import enqueue_scoring_for_finished_match


async def sync_football_matches(
    db: Session, league_id: int = 39, season: int = 2024
):
    """
    Fetch and sync football fixtures from API-Football.

    Args:
        db: Database session
        league_id: League ID (39 = Premier League, 140 = La Liga)
        season: Year (e.g., 2024)
    """
    print(f"⚽ Syncing football matches (League {league_id}, Season {season})...")

    # Get sport
    football = db.query(Sport).filter(Sport.name == "football").first()
    if not football:
        print("❌ Football sport not found in database. Create it first.")
        return

    # Fetch from API
    client = FootballAPIClient()
    total_added = 0
    total_updated = 0

    try:
        response = await client.get_fixtures(league_id=league_id, season=season)
        fixtures = response.get("response", [])

        for fixture_data in fixtures:
            fixture = fixture_data.get("fixture", {})
            teams = fixture_data.get("teams", {})
            league = fixture_data.get("league", {})
            goals = fixture_data.get("goals", {})

            fixture_id = fixture.get("id")
            match_date_str = fixture.get("date")
            status_obj = fixture.get("status", {})
            status_short = status_obj.get("short", "NS")  # NS = Not Started

            # Parse match date
            match_date = datetime.fromisoformat(match_date_str.replace("Z", "+00:00"))

            home_team = teams.get("home", {}).get("name")
            away_team = teams.get("away", {}).get("name")

            if not fixture_id or not home_team or not away_team:
                continue

            # Map API status to our status
            status_map = {
                "NS": "scheduled",  # Not Started
                "1H": "live",  # First Half
                "HT": "live",  # Half Time
                "2H": "live",  # Second Half
                "ET": "live",  # Extra Time
                "P": "live",  # Penalty
                "FT": "finished",  # Full Time
                "AET": "finished",  # After Extra Time
                "PEN": "finished",  # After Penalty
                "PST": "postponed",
                "CANC": "cancelled",
                "ABD": "cancelled",  # Abandoned
                "AWD": "finished",  # Technical Loss
                "WO": "finished",  # WalkOver
            }

            status = status_map.get(status_short, "scheduled")

            # Check if exists
            existing = (
                db.query(Match)
                .filter(Match.external_api_id == str(fixture_id))
                .first()
            )

            if existing:
                # Update existing
                previous_status = existing.status
                existing.status = status
                existing.match_date = match_date
                existing.home_score = goals.get("home")
                existing.away_score = goals.get("away")
                total_updated += 1
                print(
                    f"  ♻️  Updated: {home_team} vs {away_team} ({status}, {match_date.date()})"
                )

                if previous_status != "finished" and status == "finished":
                    enqueue_scoring_for_finished_match(
                        db,
                        match_date=existing.match_date,
                        sport_id=football.id,
                    )
            else:
                # Create new
                match = Match(
                    sport_id=football.id,
                    external_api_id=str(fixture_id),
                    home_team=home_team,
                    away_team=away_team,
                    match_date=match_date,
                    status=status,
                    home_score=goals.get("home"),
                    away_score=goals.get("away"),
                    competition=league.get("name", "Premier League"),
                    season=str(season),
                )
                db.add(match)
                total_added += 1
                print(
                    f"  ✅ Added: {home_team} vs {away_team} ({status}, {match_date.date()})"
                )

        db.commit()
        print(
            f"✅ Football matches synced! Added: {total_added}, Updated: {total_updated}"
        )

    except Exception as e:
        print(f"❌ Error syncing football matches: {e}")
        db.rollback()


async def sync_basketball_games(db: Session, season: int = 2024):
    """
    Fetch and sync basketball games from API-NBA.

    Args:
        db: Database session
        season: Year (e.g., 2024)
    """
    print(f"🏀 Syncing basketball games (Season {season})...")

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
        response = await client.get_games(season=season)
        games = response.get("response", [])

        for game_data in games:
            game_id = game_data.get("id")
            date_obj = game_data.get("date", {})
            teams_obj = game_data.get("teams", {})
            scores_obj = game_data.get("scores", {})
            status_obj = game_data.get("status", {})

            # Parse date
            date_str = date_obj.get("start")
            if not date_str:
                continue

            match_date = datetime.fromisoformat(date_str.replace("Z", "+00:00"))

            home_team = teams_obj.get("home", {}).get("name")
            away_team = teams_obj.get("visitors", {}).get("name")

            if not game_id or not home_team or not away_team:
                continue

            # Map API status
            status_long = status_obj.get("long", "Scheduled")
            status = "scheduled"
            if "Live" in status_long or "In Play" in status_long:
                status = "live"
            elif "Finished" in status_long:
                status = "finished"

            # Check if exists
            existing = (
                db.query(Match).filter(Match.external_api_id == str(game_id)).first()
            )

            if existing:
                # Update existing
                previous_status = existing.status
                existing.status = status
                existing.match_date = match_date
                existing.home_score = scores_obj.get("home", {}).get("points")
                existing.away_score = scores_obj.get("visitors", {}).get("points")
                total_updated += 1
                print(
                    f"  ♻️  Updated: {home_team} vs {away_team} ({status}, {match_date.date()})"
                )

                if previous_status != "finished" and status == "finished":
                    enqueue_scoring_for_finished_match(
                        db,
                        match_date=existing.match_date,
                        sport_id=basketball.id,
                    )
            else:
                # Create new
                match = Match(
                    sport_id=basketball.id,
                    external_api_id=str(game_id),
                    home_team=home_team,
                    away_team=away_team,
                    match_date=match_date,
                    status=status,
                    home_score=scores_obj.get("home", {}).get("points"),
                    away_score=scores_obj.get("visitors", {}).get("points"),
                    competition="NBA",
                    season=str(season),
                )
                db.add(match)
                total_added += 1
                print(
                    f"  ✅ Added: {home_team} vs {away_team} ({status}, {match_date.date()})"
                )

        db.commit()
        print(
            f"✅ Basketball games synced! Added: {total_added}, Updated: {total_updated}"
        )

    except Exception as e:
        print(f"❌ Error syncing basketball games: {e}")
        db.rollback()


async def sync_cricket_matches(db: Session):
    """
    Fetch and sync cricket matches from CricAPI.

    Args:
        db: Database session
    """
    print("🏏 Syncing cricket matches...")

    # Get sport
    cricket = db.query(Sport).filter(Sport.name == "cricket").first()
    if not cricket:
        print("❌ Cricket sport not found in database. Create it first.")
        return

    # Fetch from API
    client = CricketAPIClient()
    total_added = 0
    total_updated = 0

    try:
        response = await client.get_matches()
        matches_data = response.get("data", [])

        for match in matches_data:
            match_id = match.get("id")
            name = match.get("name", "")  # e.g., "India vs Australia"
            match_type = match.get("matchType", "")
            date_str = match.get("date")
            status = match.get("status", "")

            if not match_id or not name:
                continue

            # Parse teams from name
            teams = name.split(" vs ")
            if len(teams) != 2:
                continue

            home_team = teams[0].strip()
            away_team = teams[1].strip()

            # Parse date
            match_date = datetime.fromisoformat(date_str.replace("Z", "+00:00"))

            # Map status
            our_status = "scheduled"
            if "Live" in status:
                our_status = "live"
            elif "Completed" in status or "Won" in status:
                our_status = "finished"

            # Check if exists
            existing = (
                db.query(Match).filter(Match.external_api_id == match_id).first()
            )

            if existing:
                # Update existing
                previous_status = existing.status
                existing.status = our_status
                existing.match_date = match_date
                total_updated += 1
                print(
                    f"  ♻️  Updated: {home_team} vs {away_team} ({our_status}, {match_date.date()})"
                )

                if previous_status != "finished" and our_status == "finished":
                    enqueue_scoring_for_finished_match(
                        db,
                        match_date=existing.match_date,
                        sport_id=cricket.id,
                    )
            else:
                # Create new
                new_match = Match(
                    sport_id=cricket.id,
                    external_api_id=match_id,
                    home_team=home_team,
                    away_team=away_team,
                    match_date=match_date,
                    status=our_status,
                    competition=match_type,
                    season="2024",  # CricAPI doesn't have explicit seasons
                )
                db.add(new_match)
                total_added += 1
                print(
                    f"  ✅ Added: {home_team} vs {away_team} ({our_status}, {match_date.date()})"
                )

        db.commit()
        print(
            f"✅ Cricket matches synced! Added: {total_added}, Updated: {total_updated}"
        )

    except Exception as e:
        print(f"❌ Error syncing cricket matches: {e}")
        db.rollback()

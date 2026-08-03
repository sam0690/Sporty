"""
Basketball data sync service.

Players and teams are ingested from nba_api via the shared sync helper.
Game syncing still uses the existing BallDontLie flow.
"""

import asyncio
import logging
from datetime import datetime, date, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.redis import cache_get, cache_set, cache_pattern_delete
from app.match.models import Match
from app.league.models import Sport, Season
from app.services.sync.player_sync import sync_basketball_players

logger = logging.getLogger(__name__)


def season_label(season: int) -> str:
    """2026 -> '2026-27' (the form stored on Match.season for basketball)."""
    return f"{season}-{str(season + 1)[-2:]}"


def current_nba_season() -> int:
    """Season start year for today. NBA years roll over at the August schedule drop."""
    today = date.today()
    return today.year if today.month >= 8 else today.year - 1


def match_fields(game: dict[str, Any], sport_id, season: int) -> dict[str, Any] | None:
    """Map a BallDontLie game payload onto Match columns. None = unusable row.

    Teams are stored as abbreviations ("LAL") because that is what basketball
    RealTeam.name holds — full names here would not join to the roster.
    """
    external_id = game.get("id")
    home = (game.get("home_team") or {}).get("abbreviation")
    away = (game.get("visitor_team") or {}).get("abbreviation")
    if not external_id or not home or not away:
        return None

    # `datetime` is the UTC tip-off; `date` is the US-local calendar date and
    # is all we get for games the NBA has not time-stamped yet.
    raw = game.get("datetime")
    if raw:
        kickoff = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    else:
        kickoff = datetime.fromisoformat(game["date"]).replace(tzinfo=timezone.utc)

    status = (game.get("status") or "").lower()
    if "final" in status:
        state = "finished"
    elif game.get("period"):
        state = "live"
    else:
        state = "scheduled"

    return {
        "sport_id": sport_id,
        "external_api_id": f"bdl:{external_id}",
        "home_team": home,
        "away_team": away,
        "match_date": kickoff,
        "status": state,
        "home_score": game.get("home_team_score") if state != "scheduled" else None,
        "away_score": game.get("visitor_team_score") if state != "scheduled" else None,
        "competition": "NBA",
        "season": season_label(season),
    }


async def sync_basketball_games(db: Session, season: int | None = None) -> dict:
    """
    Sync all NBA games for a season from BallDontLie API.

    Safe to re-run: matches are upserted on external_api_id, so running this
    before the NBA publishes the schedule is a no-op that costs one request.

    Args:
        db: SQLAlchemy Session for database operations
        season: NBA season start year (default: the current season)

    Returns:
        Dict with sync statistics: {total: int, new: int, updated: int, errors: int}
    """
    season = season if season is not None else current_nba_season()
    logger.info(f"🏀 Starting basketball games sync for season {season}...")
    stats = {"total": 0, "new": 0, "updated": 0, "errors": 0}

    try:
        # Get Basketball sport
        sport = db.query(Sport).filter(Sport.name == "basketball").first()

        if not sport:
            logger.error("Basketball sport not found in database")
            return stats

        # Guard only — Match rows carry a season *string*, not a Season FK. This
        # refuses to ingest fixtures for a season the app has no Season row for,
        # which is what leagues/transfer windows actually hang off.
        has_season = (
            db.query(Season)
            .filter(Season.sport_id == sport.id, Season.is_active.is_(True))
            .first()
        )
        if not has_season:
            logger.error("No active basketball season in the database — create one first")
            return stats

        # Initialize API client lazily so importing this module does not require
        # the optional BallDontLie dependency unless game sync is used.
        from app.external_apis.basketball_balldontlie import BasketballBallDontLieClient

        api_client = BasketballBallDontLieClient(api_key=settings.BALLDONTLIE_API_KEY)

        # Fetch all games from BallDontLie
        games_data = await api_client.get_all_games(season=season, use_cache=True)
        logger.info(f"Fetched {len(games_data)} games from BallDontLie")

        for game_data in games_data:
            try:
                fields = match_fields(game_data, sport.id, season)
                if fields is None:
                    logger.warning(f"Skipping game with incomplete data: {game_data}")
                    stats["errors"] += 1
                    continue

                existing_match = (
                    db.query(Match)
                    .filter(Match.external_api_id == fields["external_api_id"])
                    .first()
                )

                if existing_match:
                    # Fixtures get rescheduled and scores land later, so refresh
                    # everything rather than just bumping updated_at.
                    for key, value in fields.items():
                        setattr(existing_match, key, value)
                    stats["updated"] += 1
                else:
                    db.add(Match(**fields))
                    stats["new"] += 1

                stats["total"] += 1

            except Exception as e:
                logger.error(f"Error processing game {game_data}: {e}")
                stats["errors"] += 1
                continue

        # Commit all changes
        db.commit()
        logger.info(f"✓ Basketball games sync complete: {stats}")

        # Update cache with last sync time
        cache_set(
            f"sync:basketball:games:season:{season}:last_sync",
            {"timestamp": datetime.utcnow().isoformat()},
            ttl_seconds=86400,  # 24 hours
        )

        return stats

    except Exception as e:
        logger.error(f"✗ Basketball games sync failed: {e}")
        db.rollback()
        return stats

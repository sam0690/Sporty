"""
Basketball data sync service.

Players and teams are ingested from nba_api via the shared sync helper.
Game syncing still uses the existing BallDontLie flow.
"""

import asyncio
import logging
from datetime import datetime, date, timezone
from typing import Any

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.redis import cache_get, cache_set, cache_pattern_delete
from app.match.models import Match
from app.league.models import Sport, Season
from app.player.models import RealTeam
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


async def sync_basketball_team_meta(db: Session) -> int:
    """Fill conference/division/city on our NBA RealTeam rows. One free request.

    The CSV importer that seeded these rows only had abbreviations, so all 30
    were left NULL — and standings group by conference and division, so without
    this every team lands in an "unknown" bucket. Matched on abbreviation
    because that is what basketball RealTeam.name holds.
    """
    sport = db.query(Sport).filter(Sport.name == "basketball").first()
    if sport is None:
        return 0

    from app.external_apis.basketball_balldontlie import BasketballBallDontLieClient

    client = BasketballBallDontLieClient(api_key=settings.BALLDONTLIE_API_KEY)
    payload = await client.get_teams_meta()
    if not payload:
        return 0

    # Defunct franchises share abbreviations with current ones — "WAS" is both
    # the Wizards and the 1940s Washington Capitols — and the dead ones carry a
    # BLANK-BUT-PRESENT conference ("    "), which is truthy. Strip before
    # testing, or the defunct row wins the dict and wipes a live team's
    # conference.
    by_abbrev = {
        team["abbreviation"]: team
        for team in payload
        if team.get("abbreviation") and str(team.get("conference") or "").strip()
    }

    updated = 0
    for real_team in db.query(RealTeam).filter(RealTeam.sport_id == sport.id).all():
        source = by_abbrev.get(real_team.abbreviation or real_team.name)
        if source is None:
            logger.warning("No BallDontLie metadata for basketball team %r", real_team.name)
            continue
        real_team.conference = source["conference"].strip()
        real_team.division = str(source.get("division") or "").strip() or None
        real_team.city = str(source.get("city") or "").strip() or None
        updated += 1

    db.commit()
    logger.info("✓ Basketball team metadata: %s of 30 teams updated", updated)
    return updated


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

        # Conference/division come with the fixtures rather than from a separate
        # one-off: standings group on them, so a fresh environment that only ever
        # runs this sync must not end up with 30 unclassified teams. One free
        # request, and it commits itself before the rollback below.
        await sync_basketball_team_meta(db)

        # Release the connection before the fetch. get_all_games paginates a
        # full season with a 12.5s sleep between pages — several MINUTES during
        # which a held connection sits idle and gets closed server-side (Neon
        # does exactly this). pool_pre_ping only revalidates at checkout, so it
        # cannot save a connection dropped mid-session; ending the transaction
        # here means the upserts below check out a fresh, pinged one.
        db.rollback()

        # Initialize API client lazily so importing this module does not require
        # the optional BallDontLie dependency unless game sync is used.
        from app.external_apis.basketball_balldontlie import BasketballBallDontLieClient

        api_client = BasketballBallDontLieClient(api_key=settings.BALLDONTLIE_API_KEY)

        # Fetch all games from BallDontLie
        games_data = await api_client.get_all_games(season=season, use_cache=True)
        logger.info(f"Fetched {len(games_data)} games from BallDontLie")

        rows: list[dict] = []
        for game_data in games_data:
            fields = match_fields(game_data, sport.id, season)
            if fields is None:
                logger.warning(f"Skipping game with incomplete data: {game_data}")
                stats["errors"] += 1
                continue
            rows.append(fields)

        if rows:
            # ONE round trip, not one per game. A full NBA season is ~1,230
            # fixtures, and a per-game SELECT-then-insert against a remote
            # Postgres costs ~10 minutes of pure latency — untenable for a
            # daily job. external_api_id is unique, so Postgres can do the
            # whole upsert itself.
            external_ids = [row["external_api_id"] for row in rows]
            already = {
                external_id
                for (external_id,) in db.query(Match.external_api_id)
                .filter(Match.external_api_id.in_(external_ids))
                .all()
            }
            stats["updated"] = len(already)
            stats["new"] = len(rows) - len(already)
            stats["total"] = len(rows)

            statement = pg_insert(Match).values(rows)
            db.execute(
                statement.on_conflict_do_update(
                    index_elements=["external_api_id"],
                    # Fixtures get rescheduled and scores land later, so refresh
                    # everything rather than just bumping updated_at.
                    set_={
                        key: statement.excluded[key]
                        for key in rows[0]
                        if key != "external_api_id"
                    },
                )
            )

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

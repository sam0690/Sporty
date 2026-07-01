from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.redis import cache_delete
from app.core.redis_lock import redis_lock
from app.league.models import League, LeagueSport, LeagueStatus, Sport, TransferWindow
from app.services.scoring.player_scoring import (
    score_cricket_players_for_window,
    score_football_players_for_window,
    score_nba_players_for_window,
)
from app.services.scoring.ranking import apply_rankings_for_league_window
from app.services.scoring.team_scoring import upsert_team_weekly_scores


logger = logging.getLogger(__name__)


def score_transfer_window_for_league(
    db: Session,
    *,
    league_id: uuid.UUID,
    transfer_window_id: uuid.UUID,
) -> dict[str, int | bool | str]:
    # Algorithm: lock (league,window), score player stats by sport rules, upsert team weekly scores, apply SQL RANK rankings, invalidate leaderboard cache key.
    lock_key = f"lock:score:{league_id}:{transfer_window_id}"
    with redis_lock(lock_key, ttl_seconds=300) as acquired:
        if not acquired:
            return {
                "skipped": True,
                "reason": "lock_held",
                "football_players_updated": 0,
                "cricket_players_updated": 0,
                "basketball_players_updated": 0,
            }

        league = db.query(League).filter(League.id == league_id).first()
        if not league:
            raise ValueError(f"League {league_id} not found")

        # Only a live league scores. Before ACTIVE (SETUP/DRAFTING) squads aren't
        # finalized, so there is nothing legitimate to score — skip so a shared
        # season window doesn't create phantom scores/rankings for leagues that
        # haven't started. (ACTIVE and COMPLETED still score: COMPLETED covers
        # the final gameweek and idempotent re-scoring of a finished season.)
        if league.status in (LeagueStatus.SETUP, LeagueStatus.DRAFTING):
            logger.info(
                "Skipping scoring for league %s: %s phase",
                league_id, league.status.value,
            )
            return {
                "skipped": True,
                "reason": "league_not_active",
                "league_status": league.status.value,
                "football_players_updated": 0,
                "cricket_players_updated": 0,
                "basketball_players_updated": 0,
            }

        sport_ids = [
            sport_id
            for (sport_id,) in (
                db.query(LeagueSport.sport_id)
                .filter(LeagueSport.league_id == league_id)
                .all()
            )
        ]

        updated_football = 0
        updated_cricket = 0
        updated_basketball = 0

        if sport_ids:
            sports = db.query(Sport.id, Sport.name).filter(Sport.id.in_(sport_ids)).all()
            for sport_id, sport_name in sports:
                slug = (sport_name or "").strip().lower()
                if slug == "football":
                    updated_football += score_football_players_for_window(
                        db,
                        league_id=league_id,
                        sport_id=sport_id,
                        transfer_window_id=transfer_window_id,
                    )
                elif slug == "cricket":
                    updated_cricket += score_cricket_players_for_window(
                        db,
                        league_id=league_id,
                        sport_id=sport_id,
                        transfer_window_id=transfer_window_id,
                    )
                elif slug == "basketball":
                    updated_basketball += score_nba_players_for_window(
                        db,
                        league_id=league_id,
                        sport_id=sport_id,
                        transfer_window_id=transfer_window_id,
                    )

        upsert_team_weekly_scores(
            db,
            league_id=league_id,
            transfer_window_id=transfer_window_id,
        )
        apply_rankings_for_league_window(
            db,
            league_id=league_id,
            transfer_window_id=transfer_window_id,
        )

        cache_delete(f"leaderboard:{league_id}:{transfer_window_id}")

        return {
            "football_players_updated": updated_football,
            "cricket_players_updated": updated_cricket,
            "basketball_players_updated": updated_basketball,
        }


def score_transfer_window_for_season_leagues(
    db: Session,
    *,
    transfer_window_id: uuid.UUID,
    commit: bool = True,
) -> dict[str, int]:
    # Algorithm: resolve season from transfer window, score every league in that season idempotently, then commit once.
    try:
        window = db.query(TransferWindow).filter(TransferWindow.id == transfer_window_id).first()
        if not window:
            raise ValueError(f"TransferWindow {transfer_window_id} not found")

        league_ids = [
            league_id
            for (league_id,) in (
                db.query(League.id).filter(League.season_id == window.season_id).all()
            )
        ]

        total_football = 0
        total_cricket = 0
        total_basketball = 0

        for league_id in league_ids:
            result = score_transfer_window_for_league(
                db,
                league_id=league_id,
                transfer_window_id=transfer_window_id,
            )
            total_football += int(result.get("football_players_updated", 0))
            total_cricket += int(result.get("cricket_players_updated", 0))
            total_basketball += int(result.get("basketball_players_updated", 0))

        output = {
            "leagues_scored": len(league_ids),
            "football_players_updated": total_football,
            "cricket_players_updated": total_cricket,
            "basketball_players_updated": total_basketball,
        }
        if commit:
            db.commit()
        return output
    except Exception:
        if commit:
            db.rollback()
        raise


def score_active_transfer_windows(db: Session, *, commit: bool = True) -> dict[str, int]:
    # Algorithm: find active windows with start_at <= now < end_at, score each season window pipeline, and aggregate totals.
    try:
        now = datetime.now(timezone.utc)
        active_window_rows = (
            db.query(TransferWindow.id)
            .filter(TransferWindow.start_at <= now)
            .filter(TransferWindow.end_at > now)
            .all()
        )

        windows = [window_id for (window_id,) in active_window_rows]
        leagues_scored = 0
        football_updated = 0
        cricket_updated = 0
        basketball_updated = 0

        for window_id in windows:
            result = score_transfer_window_for_season_leagues(
                db,
                transfer_window_id=window_id,
                commit=False,
            )
            leagues_scored += result.get("leagues_scored", 0)
            football_updated += result.get("football_players_updated", 0)
            cricket_updated += result.get("cricket_players_updated", 0)
            basketball_updated += result.get("basketball_players_updated", 0)

        output = {
            "windows_scored": len(windows),
            "leagues_scored": leagues_scored,
            "football_players_updated": football_updated,
            "cricket_players_updated": cricket_updated,
            "basketball_players_updated": basketball_updated,
        }
        if commit:
            db.commit()
        return output
    except Exception:
        if commit:
            db.rollback()
        raise

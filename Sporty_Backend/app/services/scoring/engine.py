from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.redis import cache_delete
from app.core.redis_lock import redis_lock
from app.league.models import League, LeagueSport, LeagueStatus, Season, Sport, TransferWindow
from app.services.scoring.player_scoring import (
    score_cricket_players_for_window,
    score_football_players_for_window,
    score_nba_players_for_window,
)
from app.services.matchup_service import resolve_matchups_for_window
from app.services.scoring.ranking import apply_rankings_for_league_window
from app.services.scoring.team_scoring import upsert_team_weekly_scores
from app.services.scoring.window_locator import find_equivalent_window_for_sport


logger = logging.getLogger(__name__)


def _score_player_stats_once_per_sport(
    db: Session,
    *,
    league_ids: list[uuid.UUID],
    window: TransferWindow,
) -> dict[str, int]:
    # Player-stat scoring has no per-league dimension (player_gameweek_stats
    # has no league_id — it's one row per player+window, shared by every
    # league playing that sport), so it must run exactly once per sport for
    # this window, not once per league. Resolve the distinct sports played
    # across all the leagues sharing this window, translate each to its own
    # equivalent window (a multisport league's window id is only native for
    # one sport — see find_equivalent_window_for_sport), and score it once.
    totals = {"football_players_updated": 0, "cricket_players_updated": 0, "basketball_players_updated": 0}
    if not league_ids:
        return totals

    sports = (
        db.query(Sport.id, Sport.name)
        .join(LeagueSport, LeagueSport.sport_id == Sport.id)
        .filter(LeagueSport.league_id.in_(league_ids))
        .distinct()
        .all()
    )

    for sport_id, sport_name in sports:
        sport_window = find_equivalent_window_for_sport(db, window=window, sport_id=sport_id)
        if sport_window is None:
            continue
        sport_window_id = sport_window.id
        slug = (sport_name or "").strip().lower()
        try:
            if slug == "football":
                totals["football_players_updated"] += score_football_players_for_window(
                    db, sport_id=sport_id, transfer_window_id=sport_window_id,
                )
            elif slug == "cricket":
                totals["cricket_players_updated"] += score_cricket_players_for_window(
                    db, sport_id=sport_id, transfer_window_id=sport_window_id,
                )
            elif slug == "basketball":
                totals["basketball_players_updated"] += score_nba_players_for_window(
                    db, sport_id=sport_id, transfer_window_id=sport_window_id,
                )
        except Exception:
            # score_*_players_for_window already retries transient deadlocks
            # internally (via a SAVEPOINT) before raising, so by the time an
            # exception reaches here the session is not poisoned — one sport
            # failing must not block scoring the others sharing this window.
            logger.exception(
                "Skipping player-stat scoring for sport %s window %s", sport_id, window.id
            )
            continue

    return totals


def score_transfer_window_for_league(
    db: Session,
    *,
    league_id: uuid.UUID,
    transfer_window_id: uuid.UUID,
) -> dict[str, bool | str]:
    # Algorithm: lock (league,window), upsert team weekly scores from the
    # already-scored player stats, apply SQL RANK rankings, invalidate the
    # leaderboard cache key. Player-stat scoring itself happens once per
    # sport before this is called — see _score_player_stats_once_per_sport.
    lock_key = f"lock:score:{league_id}:{transfer_window_id}"
    with redis_lock(lock_key, ttl_seconds=300) as acquired:
        if not acquired:
            return {"skipped": True, "reason": "lock_held"}

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
            }

        upsert_team_weekly_scores(
            db,
            league_id=league_id,
            transfer_window_id=transfer_window_id,
        )
        if league.is_head_to_head:
            resolve_matchups_for_window(db, league_id, transfer_window_id)
        apply_rankings_for_league_window(
            db,
            league_id=league_id,
            transfer_window_id=transfer_window_id,
        )

        cache_delete(f"leaderboard:{league_id}:{transfer_window_id}")

        return {}


def score_transfer_window_for_season_leagues(
    db: Session,
    *,
    transfer_window_id: uuid.UUID,
    commit: bool = True,
) -> dict[str, int]:
    # Algorithm: resolve the window's sport, score every league that plays that
    # sport (via LeagueSport — NOT League.season_id, which is a single FK that
    # only points at one of a multisport league's sports; matching on it alone
    # would silently skip every league for every OTHER sport's windows), then
    # commit once.
    try:
        window = db.query(TransferWindow).filter(TransferWindow.id == transfer_window_id).first()
        if not window:
            raise ValueError(f"TransferWindow {transfer_window_id} not found")

        window_sport_id = db.query(Season.sport_id).filter(Season.id == window.season_id).scalar()

        league_ids = [
            league_id
            for (league_id,) in (
                db.query(League.id)
                .join(LeagueSport, LeagueSport.league_id == League.id)
                .filter(LeagueSport.sport_id == window_sport_id)
                .distinct()
                .all()
            )
        ]

        player_stat_totals = _score_player_stats_once_per_sport(
            db, league_ids=league_ids, window=window
        )

        leagues_skipped = 0
        for league_id in league_ids:
            try:
                # Each league gets its own SAVEPOINT: if this league's scoring
                # raises (deadlock, deleted mid-run, etc.), only its savepoint
                # rolls back — the outer transaction, and any prior leagues'
                # already-computed scores within it, stay intact for the
                # eventual commit below.
                with db.begin_nested():
                    score_transfer_window_for_league(
                        db,
                        league_id=league_id,
                        transfer_window_id=transfer_window_id,
                    )
            except Exception:
                # A single league failing (e.g. deleted mid-run, in a race with
                # the league_ids query above) must not abort scoring for every
                # other league sharing this window.
                logger.exception(
                    "Skipping league %s while scoring window %s", league_id, transfer_window_id
                )
                leagues_skipped += 1
                continue

        output = {
            "leagues_scored": len(league_ids) - leagues_skipped,
            "leagues_skipped": leagues_skipped,
            **player_stat_totals,
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

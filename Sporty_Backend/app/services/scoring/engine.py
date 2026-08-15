from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.redis_lock import redis_lock
from app.league import read_cache
from app.player import read_cache as player_read_cache
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
    # league playing that sport), so it must run exactly once per (sport,
    # resolved window) for this window, not once per league. Under per-
    # league season mapping (LeagueSport.season_id), two leagues sharing
    # this window CAN legitimately resolve the same sport to different
    # equivalent windows (different seasons) — so resolve per (league, sport)
    # pair, then dedupe by (sport_id, resolved window id) before scoring.
    # In the common case (every league mapping a sport to the same season)
    # this collapses back to exactly one pass per sport, same as before —
    # the dedup is what preserves the deadlock-avoidance property this
    # function exists for (see the module CLAUDE.md note on player_gameweek_stats).
    totals = {
        "football_players_updated": 0,
        "cricket_players_updated": 0,
        "basketball_players_updated": 0,
        "leagues_skipped_no_equivalent_season": 0,
    }
    if not league_ids:
        return totals

    league_sports = (
        db.query(LeagueSport.league_id, Sport.id, Sport.name)
        .join(Sport, Sport.id == LeagueSport.sport_id)
        .filter(LeagueSport.league_id.in_(league_ids))
        .all()
    )

    resolved: dict[tuple[uuid.UUID, uuid.UUID], str] = {}
    for league_id, sport_id, sport_name in league_sports:
        sport_window = find_equivalent_window_for_sport(
            db, league_id=league_id, window=window, sport_id=sport_id
        )
        if sport_window is None:
            totals["leagues_skipped_no_equivalent_season"] += 1
            logger.warning(
                "No equivalent %s window for league=%s (window=%s) — skipping "
                "player-stat scoring for this league/sport this cycle",
                sport_name, league_id, window.id,
            )
            continue
        resolved[(sport_id, sport_window.id)] = sport_name

    for (sport_id, sport_window_id), sport_name in resolved.items():
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
                "Skipping player-stat scoring for sport %s window %s", sport_id, sport_window_id
            )
            continue

    return totals


def score_transfer_window_for_league(
    db: Session,
    *,
    league_id: uuid.UUID,
    transfer_window_id: uuid.UUID,
) -> dict[str, bool | str]:
    # Algorithm: translate the window to the league's native schedule, lock
    # (league,window), upsert team weekly scores from the already-scored
    # player stats, apply SQL RANK rankings, invalidate the leaderboard cache
    # key. Player-stat scoring itself happens once per sport before this is
    # called — see _score_player_stats_once_per_sport.
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise ValueError(f"League {league_id} not found")

    # Callers may hand us any sport's window: the sweep maps windows to
    # leagues via LeagueSport, so a multisport league is reached once per
    # sport it plays. But lineups and TeamWeeklyScore rows only ever live
    # under the league's OWN season's windows — scoring under a foreign
    # sport's window id writes phantom 0-point rows (duplicate gameweek bars
    # on the dashboard, everyone-ranks-#1 rows polluting power rankings).
    # Translate to the league-native window before doing anything, including
    # taking the lock, so foreign and native callers converge on one lock
    # key. Same-sport windows pass through unchanged.
    window = (
        db.query(TransferWindow)
        .filter(TransferWindow.id == transfer_window_id)
        .first()
    )
    if not window:
        raise ValueError(f"TransferWindow {transfer_window_id} not found")
    league_sport_id = (
        db.query(Season.sport_id).filter(Season.id == league.season_id).scalar()
    )
    if league_sport_id is None:
        # UNIFIED-season league: its lineups and TeamWeeklyScore rows live under
        # the unified season's OWN windows. Translate the incoming (real-sport)
        # window to the unified window covering the same instant — a covering-
        # date lookup on the unified season's own windows (identical in shape to
        # find_equivalent_window_for_sport, but keyed straight to league.season_id
        # instead of a per-sport LeagueSport mapping, which resolves real sports
        # only). If no unified window covers this date, the incoming window is
        # outside the multisport overlap period → nothing to score for this
        # league (which is how "compete only within the overlap" is enforced —
        # no explicit date check needed). See UNIFIED_MULTISPORT_SCHEDULE_PLAN.md §3/§5.
        native_window = (
            db.query(TransferWindow)
            .filter(
                TransferWindow.season_id == league.season_id,
                # Unified/combined schedules are competition-agnostic (NULL) —
                # a unified season never holds per-competition football windows.
                TransferWindow.competition.is_(None),
                TransferWindow.start_at <= window.start_at,
                TransferWindow.end_at > window.start_at,
            )
            .order_by(TransferWindow.start_at.desc())
            .first()
        )
    else:
        native_window = find_equivalent_window_for_sport(
            db, league_id=league_id, window=window, sport_id=league_sport_id
        )
    if native_window is None:
        # The league's own schedule has no window covering this date range
        # (season not started / ended / off week) — nothing to score. Loud,
        # not silent: this is the league's OWN native sport, so unlike the
        # off-week case for a secondary sport, this should basically never
        # fire post-creation (create_league/add_sport hard-block leagues
        # from existing without a resolvable season) — worth a log line if
        # it ever does.
        logger.warning(
            "No native window for league=%s (window=%s, sport=%s) — skipping scoring",
            league_id, window.id, league_sport_id,
        )
        return {"skipped": True, "reason": "no_native_window"}
    transfer_window_id = native_window.id

    lock_key = f"lock:score:{league_id}:{transfer_window_id}"
    with redis_lock(lock_key, ttl_seconds=300) as acquired:
        if not acquired:
            return {"skipped": True, "reason": "lock_held"}

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

        # Ranks/points just changed for this league — drop its cached
        # leaderboard + power-rankings. Must use read_cache's `league_read:*`
        # namespace; `leaderboard:*` is a pub/sub channel name, not a cache key.
        read_cache.bust_league(league_id)

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

        if window_sport_id is None:
            # A UNIFIED-season window has no real sport to map leagues by, and
            # must NOT self-trigger scoring. Unified leagues are scored via their
            # COMPONENT sports' window passes (that's when new PlayerGameweekStat
            # rows actually land), translated onto this unified window inside
            # score_transfer_window_for_league. Player-stat scoring is always
            # real-sport-keyed and already booked via the real windows, so there
            # is nothing to do for the unified window's own activation — it is
            # inert as a discovery driver. See UNIFIED_MULTISPORT_SCHEDULE_PLAN.md §4/§5.
            if commit:
                db.commit()
            return {
                "leagues_scored": 0,
                "leagues_skipped": 0,
                "football_players_updated": 0,
                "cricket_players_updated": 0,
                "basketball_players_updated": 0,
                "leagues_skipped_no_equivalent_season": 0,
            }

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
            # fantasy_points just changed for a whole window of players.
            player_read_cache.bust_all()
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
        leagues_skipped_no_equivalent_season = 0

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
            leagues_skipped_no_equivalent_season += result.get("leagues_skipped_no_equivalent_season", 0)

        output = {
            "windows_scored": len(windows),
            "leagues_scored": leagues_scored,
            "football_players_updated": football_updated,
            "cricket_players_updated": cricket_updated,
            "basketball_players_updated": basketball_updated,
            "leagues_skipped_no_equivalent_season": leagues_skipped_no_equivalent_season,
        }
        if commit:
            db.commit()
            player_read_cache.bust_all()
        return output
    except Exception:
        if commit:
            db.rollback()
        raise

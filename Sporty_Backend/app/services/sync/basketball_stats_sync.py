"""NBA per-window stat rollup from stats.nba.com (nba_api).

`PlayerGameweekStat` is one row per (player, transfer_window), and an NBA team
plays 3-4 games inside one weekly window — so the row is a SUM over the window,
not a single game's box score. nba_api's PlayerGameLogs takes a date range and
returns every player's per-game line for it, so one request rebuilds the whole
league's rollup for a window. That is also why no Match <-> NBA-game-id mapping
is needed here: the window's date range is the only key.

Recompute, never increment: the summed totals are ASSIGNED each run, so
re-running mid-window is idempotent and a late stat correction self-heals. This
is what makes the sweep safe to schedule daily alongside the live tick.

Identity: the basketball roster catalog is ingested from this same provider
(player_sync.sync_basketball_players, via nba_api), so PlayerGameLogs' PLAYER_ID
matches Player.external_api_id as f"nba:{PLAYER_ID}" exactly — no name matching.

Provider caveat: stats.nba.com is unofficial and is known to block some cloud
egress IPs. Every call goes through _fetch_game_logs so a provider swap (e.g.
BallDontLie ALL-STAR, whose SDK stats call is already wired in
basketball_balldontlie.py) is a one-function change.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from collections import defaultdict
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.league.models import Season, Sport, TransferWindow
from app.player.models import Player, PlayerGameweekStat
from app.player.models_nba import NBAStat
from app.services.scoring.player_scoring import score_nba_players_for_window
from app.services.sync.basketball_sync import season_label

logger = logging.getLogger(__name__)

# player_gameweek_stats carries CheckConstraint("minutes_played <= 300"). A real
# NBA week peaks near 200 (4 games x ~40 min), so this is a guard, not a normal
# path — deliberately NOT dataset_importer._cap_minutes, which caps at 120
# because its figure is per-GAME and would truncate a legitimate week.
_MAX_WINDOW_MINUTES = 300

# PlayerGameLogs column -> NBAStat column.
_STAT_COLUMNS = {
    "PTS": "points",
    "AST": "assists",
    "REB": "rebounds",
    "STL": "steals",
    "BLK": "blocks",
}


def _fetch_game_logs(season: str, date_from: str, date_to: str) -> list[dict]:
    """Every player's per-game line in [date_from, date_to]. Sole provider call.

    Dates are MM/DD/YYYY — the only format stats.nba.com accepts here.
    """
    from nba_api.stats.endpoints import playergamelogs

    response = playergamelogs.PlayerGameLogs(
        season_nullable=season,
        date_from_nullable=date_from,
        date_to_nullable=date_to,
        timeout=60,
    )
    return response.get_data_frames()[0].to_dict("records")


def _season_label_for_window(window: TransferWindow) -> str:
    """'2026-27' from the window's own start date, via the NBA August rollover."""
    start = window.start_at
    return season_label(start.year if start.month >= 8 else start.year - 1)


async def sync_basketball_window_stats(db: Session, window: TransferWindow) -> dict:
    """Rebuild every basketball PlayerGameweekStat/NBAStat row for one window.

    Top-level entry point: owns and commits its own transaction.
    """
    stats = {"players": 0, "unknown_players": 0, "rows": 0, "scored": 0}

    sport = db.query(Sport).filter(Sport.name == "basketball").first()
    if sport is None:
        logger.error("Basketball sport not seeded — window stats not synced")
        return stats

    date_from = window.start_at.strftime("%m/%d/%Y")
    date_to = window.end_at.strftime("%m/%d/%Y")
    season = _season_label_for_window(window)

    try:
        # nba_api is synchronous (requests) — keep the event loop free.
        rows = await asyncio.to_thread(_fetch_game_logs, season, date_from, date_to)
    except Exception:
        logger.exception(
            "NBA game logs request failed for window %s (%s..%s)", window.id, date_from, date_to
        )
        return stats

    if not rows:
        logger.info("No NBA game logs in %s..%s — nothing to book", date_from, date_to)
        return stats

    # Sum each player's lines across every game inside the window.
    totals: dict[str, dict[str, float]] = defaultdict(
        lambda: dict.fromkeys([*_STAT_COLUMNS.values(), "minutes"], 0.0)
    )
    for row in rows:
        player_id = row.get("PLAYER_ID")
        if player_id is None:
            continue
        bucket = totals[f"nba:{int(player_id)}"]
        for source, target in _STAT_COLUMNS.items():
            bucket[target] += _to_number(row.get(source))
        bucket["minutes"] += _to_number(row.get("MIN"))

    players = {
        player.external_api_id: player
        for player in db.query(Player)
        .filter(Player.sport_id == sport.id, Player.external_api_id.in_(totals.keys()))
        .all()
    }
    stats["unknown_players"] = len(totals) - len(players)
    if stats["unknown_players"]:
        # Rookies and mid-season signings land here until the catalog is
        # rebuilt. Surfaced in the return value so the gap stays visible.
        logger.warning(
            "%s NBA player id(s) in %s..%s have no players row — skipped",
            stats["unknown_players"], date_from, date_to,
        )

    for external_id, player in players.items():
        bucket = totals[external_id]
        base_stat = _get_or_create_base_stat(db, player.id, window.id)
        base_stat.minutes_played = min(round(bucket["minutes"]), _MAX_WINDOW_MINUTES)
        _assign_nba_stat(db, base_stat, bucket)
        stats["rows"] += 1

    stats["players"] = len(players)
    db.flush()

    # Turns the counts just written into fantasy_points. Takes its own
    # (sport_id, transfer_window_id) Redis lock + SAVEPOINT retry internally.
    stats["scored"] = score_nba_players_for_window(
        db, sport_id=sport.id, transfer_window_id=window.id
    )
    db.commit()

    logger.info(
        "✓ NBA window %s (%s..%s): %s players, %s scored, %s unknown",
        window.id, date_from, date_to, stats["players"], stats["scored"], stats["unknown_players"],
    )
    return stats


async def sync_basketball_recent_windows(db: Session, *, lookback: int = 1) -> dict:
    """Reconciliation sweep: the window covering now, plus `lookback` before it.

    The live tick already books points at the final buzzer; this is what heals a
    night the worker missed, and what corrects a stat the provider revised.
    """
    sport = db.query(Sport).filter(Sport.name == "basketball").first()
    if sport is None:
        return {"windows": 0}

    now = datetime.now(timezone.utc)
    windows = (
        db.query(TransferWindow)
        .join(Season, Season.id == TransferWindow.season_id)
        .filter(Season.sport_id == sport.id, TransferWindow.start_at <= now)
        .order_by(TransferWindow.start_at.desc())
        .limit(lookback + 1)
        .all()
    )
    if not windows:
        return {"windows": 0}

    results = [await sync_basketball_window_stats(db, window) for window in windows]
    return {
        "windows": len(results),
        "players": sum(r["players"] for r in results),
        "scored": sum(r["scored"] for r in results),
        "unknown_players": sum(r["unknown_players"] for r in results),
    }


def _get_or_create_base_stat(
    db: Session, player_id: uuid.UUID, window_id: uuid.UUID
) -> PlayerGameweekStat:
    stat = (
        db.query(PlayerGameweekStat)
        .filter(
            PlayerGameweekStat.player_id == player_id,
            PlayerGameweekStat.transfer_window_id == window_id,
        )
        .first()
    )
    if stat is None:
        stat = PlayerGameweekStat(player_id=player_id, transfer_window_id=window_id)
        db.add(stat)
        db.flush()
    return stat


def _assign_nba_stat(db: Session, base_stat: PlayerGameweekStat, bucket: dict) -> None:
    # Assignment, not +=: `bucket` is always the FULL window recount, so a
    # re-run must converge rather than double. NBAStat's CheckConstraints
    # require non-negative values, hence the max(0, ...).
    child = db.query(NBAStat).filter(NBAStat.base_stat_id == base_stat.id).first()
    if child is None:
        child = NBAStat(base_stat_id=base_stat.id)
        db.add(child)
        db.flush()
    for column in _STAT_COLUMNS.values():
        setattr(child, column, max(0, round(bucket[column])))


def _to_number(value, default: float = 0.0) -> float:
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (TypeError, ValueError):
        return default

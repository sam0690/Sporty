"""
Player router — read-only endpoints for player data and stats.

Route prefix: /players/...

Auth pattern:
  - get_current_active_user → any authenticated, active user
  (No league membership required — player data is public reference
  data needed by all users for browsing, draft prep, and transfers.)

Transaction convention:
  - All reads — no db.commit() anywhere in this router.
  - Players are created by admins / data pipelines, not by end users.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.auth.dependencies import get_current_active_user
from app.auth.models import User
from app.core.http_cache import public_cache
from app.database import get_db
from app.league.models import Sport
from app.player import read_cache
from app.player import services as player_service
from app.player.models import RealTeam
from app.player.schemas import (
    PlayerFilter,
    PlayerGameweekStatResponse,
    PlayerListResponse,
    PlayerPriceHistoryResponse,
    PlayerRecentStatsResponse,
    PlayerResponse,
)
from app.schemas.common import TeamBrief

router = APIRouter(prefix="/players", tags=["Players"])


# ── Cached readers shared by the authed and /public twins ──────────────────
# Both variants serve identical data (see the /public section below), so they
# share one cache entry rather than each warming its own.


def _cached_player_detail(db: Session, player_id: uuid.UUID):
    cache_key = read_cache.detail_key(player_id)
    cached = read_cache.get_cached(cache_key)
    if cached is not None:
        return cached

    # Raises 404 when the player doesn't exist — nothing is cached on that path.
    result = PlayerResponse.model_validate(player_service.get_player(db, player_id))
    read_cache.set_cached(cache_key, result, read_cache.DETAIL_TTL)
    return result


def _cached_recent_stats(db: Session, player_id: uuid.UUID, limit: int):
    cache_key = read_cache.recent_stats_key(player_id, limit)
    cached = read_cache.get_cached(cache_key)
    if cached is not None:
        return cached

    rows = player_service.get_player_recent_stats(db, player_id, limit=limit)
    result = PlayerRecentStatsResponse(items=rows)
    read_cache.set_cached(cache_key, result, read_cache.RECENT_STATS_TTL)
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# GET /players — filtered, paginated list
# ═══════════════════════════════════════════════════════════════════════════════


@router.get(
    "",
    response_model=PlayerListResponse,
    summary="List players with optional filters",
)
def get_players(
    filters: PlayerFilter = Depends(),
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_active_user),
):
    """Return a paginated, filterable list of players.

    All filter fields are optional query parameters — omit everything
    to get the first page of all players.

    Q: PlayerFilter uses Depends() instead of being a plain parameter.
    ────────────────────────────────────────────────────────────────────
    Without Depends(), FastAPI treats PlayerFilter as a JSON request
    body (because it's a Pydantic model), which makes GET /players
    require a body — violating HTTP semantics (GET requests should
    not have a body) and breaking browser/cURL usage entirely.
    Depends() tells FastAPI to decompose the model's fields into
    individual query parameters instead.

    Key filters:
      - sport_name, position, real_team — narrow by metadata
      - min_cost / max_cost — budget-aware browsing
      - search — case-insensitive player name search
      - league_id — scope to this league's sports/competitions; draft
        leagues additionally hide players already rostered there
        (used for transfer pool and draft pool views)
      - page / page_size — pagination (default: page 1, 20 per page)
    """
    cache_key = read_cache.list_key(filters)
    cached = read_cache.get_cached(cache_key)
    if cached is not None:
        return cached

    players, total = player_service.get_players(db, filters)

    result = PlayerListResponse(
        items=players,
        total=total,
        page=filters.page,
        page_size=filters.page_size,
        has_next=(filters.page * filters.page_size) < total,
    )
    read_cache.set_cached(cache_key, result, read_cache.LIST_TTL)
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# GET /players/teams — list real teams (favourite-team picker)
# ═══════════════════════════════════════════════════════════════════════════════


@router.get(
    "/teams",
    response_model=list[TeamBrief],
    summary="List real teams, optionally filtered by sport",
)
def list_real_teams(
    sport_name: str | None = None,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_active_user),
):
    """Return every real-world team — a small reference table (dozens of
    rows), no pagination needed. Used by the favourite-team picker."""
    cache_key = read_cache.teams_key(sport_name)
    cached = read_cache.get_cached(cache_key)
    if cached is not None:
        return cached

    query = db.query(RealTeam).options(joinedload(RealTeam.sport))
    if sport_name:
        query = query.join(Sport, Sport.id == RealTeam.sport_id).filter(
            Sport.name == sport_name.strip().lower()
        )
    # Validate into the response model before caching: jsonable_encoder on raw
    # ORM instances would walk _sa_instance_state.
    result = [TeamBrief.model_validate(t) for t in query.order_by(RealTeam.name).all()]
    read_cache.set_cached(cache_key, result, read_cache.TEAMS_TTL)
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# GET /players/stats — bulk gameweek stats by sport
# ═══════════════════════════════════════════════════════════════════════════════


@router.get(
    "/stats",
    response_model=list[PlayerGameweekStatResponse],
    summary="Get all player stats for a gameweek and sport",
)
def get_player_stats_for_gameweek(
    gameweek_id: uuid.UUID,
    sport: str,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_active_user),
):
    """Return all stats rows for a single gameweek and sport."""
    cache_key = read_cache.gameweek_stats_key(gameweek_id, sport)
    cached = read_cache.get_cached(cache_key)
    if cached is not None:
        return cached

    rows = player_service.get_player_stats_for_gameweek(db, gameweek_id, sport)
    result = [PlayerGameweekStatResponse.model_validate(r) for r in rows]
    read_cache.set_cached(cache_key, result, read_cache.GAMEWEEK_STATS_TTL)
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# GET /players/{player_id} — single player detail
# ═══════════════════════════════════════════════════════════════════════════════


@router.get(
    "/{player_id}",
    response_model=PlayerResponse,
    summary="Get player details",
)
def get_player(
    player_id: uuid.UUID,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_active_user),
):
    """Return full details for a single player.

    The service raises 404 if the player doesn't exist — this is
    one of the cases where the service owns the error because
    "player not found" is always a 404 regardless of context.
    """
    return _cached_player_detail(db, player_id)


# ═══════════════════════════════════════════════════════════════════════════════
# GET /players/{player_id}/stats/{gameweek_id} — gameweek stat
# ═══════════════════════════════════════════════════════════════════════════════


@router.get(
    "/{player_id}/stats/{gameweek_id}",
    response_model=PlayerGameweekStatResponse,
    summary="Get player stats for a specific gameweek",
)
def get_player_stats(
    player_id: uuid.UUID,
    gameweek_id: uuid.UUID,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_active_user),
):
    """Return a player's stats for a specific gameweek.

    Why does the ROUTER raise 404 instead of the service?
    ─────────────────────────────────────────────────────
    get_player_stats() returns None when the player didn't play
    that gameweek. That's not an error in the service's world —
    "no data" is a valid domain answer (e.g. a batch-scoring job
    would just skip that player).

    But at the HTTP level, "no resource" IS a 404. The router is
    the layer that maps domain results to HTTP semantics, so the
    404 decision belongs here. This keeps the service reusable by
    non-HTTP callers that don't want exceptions for missing data.

    Contrast with get_player(): there, "player not found" is always
    an error regardless of caller, so the service raises 404 directly.
    """
    stat = player_service.get_player_stats(db, player_id, gameweek_id)
    if stat is None:
        # Distinguish: does the player exist at all?
        # This second query only fires on the None path (rare).
        # Happy path (stat exists) costs exactly one query.
        player_service.get_player(db, player_id)  # raises 404 "Player not found"
        # Player exists, just no stats for this gameweek
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No stats found for this player in the given gameweek",
        )
    return stat


@router.get(
    "/{player_id}/price-history",
    response_model=PlayerPriceHistoryResponse,
    summary="Get recent player price history",
)
def get_player_price_history(
    player_id: uuid.UUID,
    limit: int = 20,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_active_user),
):
    """Return newest-first price change records for a player."""
    cache_key = read_cache.price_history_key(player_id, limit)
    cached = read_cache.get_cached(cache_key)
    if cached is not None:
        return cached

    rows = player_service.get_player_price_history(db, player_id, limit=limit)
    result = PlayerPriceHistoryResponse(items=rows)
    read_cache.set_cached(cache_key, result, read_cache.PRICE_HISTORY_TTL)
    return result


@router.get(
    "/{player_id}/recent-stats",
    response_model=PlayerRecentStatsResponse,
    summary="Get a player's recent gameweek-by-gameweek performance",
)
def get_player_recent_stats(
    player_id: uuid.UUID,
    limit: int = 5,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_active_user),
):
    """Return newest-first gameweek stats for a player's detail view."""
    return _cached_recent_stats(db, player_id, limit)


# ═══════════════════════════════════════════════════════════════════════════════
# GET /players/public/{player_id} — unauthenticated, shareable profile
# ═══════════════════════════════════════════════════════════════════════════════
#
# Same data as get_player()/get_player_recent_stats() above — player data is
# already documented as "public reference data" (see module docstring), this
# just drops the login requirement so a shared profile link works for a
# logged-out visitor, mirroring GET /matches/public (app/match/router.py).


@router.get(
    "/public/{player_id}",
    response_model=PlayerResponse,
    summary="Get player details (no auth — shareable profile link)",
    dependencies=[Depends(public_cache(300))],
)
def get_public_player(player_id: uuid.UUID, db: Session = Depends(get_db)):
    return _cached_player_detail(db, player_id)


@router.get(
    "/public/{player_id}/recent-stats",
    response_model=PlayerRecentStatsResponse,
    summary="Get a player's recent gameweek performance (no auth)",
    dependencies=[Depends(public_cache(300))],
)
def get_public_player_recent_stats(
    player_id: uuid.UUID, limit: int = 5, db: Session = Depends(get_db)
):
    return _cached_recent_stats(db, player_id, limit)

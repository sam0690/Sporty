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
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user
from app.auth.models import User
from app.database import get_db
from app.player import services as player_service
from app.player.schemas import (
    PlayerFilter,
    PlayerGameweekStatResponse,
    PlayerListResponse,
    PlayerResponse,
)

router = APIRouter(prefix="/players", tags=["Players"])


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
      - league_id — exclude players already owned in this league
        (used for transfer pool and draft pool views)
      - page / page_size — pagination (default: page 1, 20 per page)
    """
    players, total = player_service.get_players(db, filters)

    return PlayerListResponse(
        items=players,
        total=total,
        page=filters.page,
        page_size=filters.page_size,
        has_next=(filters.page * filters.page_size) < total,
    )


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
    return player_service.get_player(db, player_id)


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

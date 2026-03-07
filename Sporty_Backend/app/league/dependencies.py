"""
Shared FastAPI Depends() callables for league-scoped auth.

Used by: app/scoring/router.py, app/league/router.py
(and any future router that needs league membership/ownership checks)

Why not reuse _require_league / _require_membership from league services?
─────────────────────────────────────────────────────────────────────────
Those are plain functions (service layer), not FastAPI Depends() callables.
Router dependencies must be functions that accept Depends-injected params
(db, current_user, league_id from path).  We could wrap the service-layer
helpers, but that couples the router to league service internals.

Instead, we define small Depends()-compatible callables here so every
router that touches league-scoped resources can share them.
"""

import uuid

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user
from app.auth.models import User
from app.database import get_db
from app.league.models import League, LeagueMembership


# ── internal helper ──────────────────────────────────────────────────────────


def _get_league_or_404(
    league_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> League:
    """Path dependency: resolve league_id → League or 404."""
    league = db.query(League).filter(League.id == league_id).first()
    if not league:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="League not found",
        )
    return league


# ── public dependencies ──────────────────────────────────────────────────────


def require_league_member(
    league: League = Depends(_get_league_or_404),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> League:
    """Ensure current_user is a member of the league.

    Returns the League so downstream code can use it without
    another query.

    Why does this also declare db = Depends(get_db)?
    ────────────────────────────────────────────────
    _get_league_or_404 already injects db.  FastAPI's DI container
    deduplicates dependencies by default — Depends(get_db) called
    in both _get_league_or_404 and here resolves to the SAME Session
    instance (same request scope).  We're not creating two sessions;
    we're just making db available as a local variable so this
    function can run its own membership query.
    """
    is_member = (
        db.query(LeagueMembership)
        .filter(
            LeagueMembership.league_id == league.id,
            LeagueMembership.user_id == current_user.id,
        )
        .first()
    )
    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this league",
        )
    return league


def require_league_owner(
    league: League = Depends(_get_league_or_404),
    current_user: User = Depends(get_current_active_user),
) -> League:
    """Ensure current_user is the OWNER of the league.

    Why check owner_id directly instead of going through memberships?
    ────────────────────────────────────────────────────────────────
    Being a member doesn't make you the owner.  owner_id is the single
    source of truth for league ownership.  Checking it directly is also
    cheaper (no JOIN or extra query — owner_id is on the League row
    we already fetched).
    """
    if league.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the league owner can perform this action",
        )
    return league

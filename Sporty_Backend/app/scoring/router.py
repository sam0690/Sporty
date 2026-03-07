"""
Scoring router — endpoints for default rules and league overrides.

Two route prefixes:
  /scoring/...                      → platform-wide default rules
  /leagues/{league_id}/scoring-... → per-league overrides

Auth patterns used:
  - get_current_active_user       → any authenticated, active user
  - require_league_member         → user must be in the league  (from league deps)
  - require_league_owner          → user must own the league    (from league deps)
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user
from app.auth.models import User
from app.database import get_db
from app.league.dependencies import require_league_member, require_league_owner
from app.league.models import League, Sport
from app.scoring import services as scoring_service
from app.scoring.schemas import (
    ScoringOverrideCreate,
    ScoringOverrideResponse,
    ScoringRuleResponse,
)

router = APIRouter(tags=["Scoring"])


# ═══════════════════════════════════════════════════════════════════════════════
# GET /scoring/rules/{sport_name} — default rules for a sport
# ═══════════════════════════════════════════════════════════════════════════════


@router.get(
    "/scoring/rules/{sport_name}",
    response_model=list[ScoringRuleResponse],
    summary="List default scoring rules for a sport",
)
def get_default_rules(
    sport_name: str,
    db: Session = Depends(get_db),
    _current_user: User = Depends(get_current_active_user),
):
    """Return all default scoring rules for the given sport.

    sport_name is the slug ("football", "cricket"), not the UUID.
    Any authenticated user can view default rules — they're public
    reference data needed by league setup UIs and rule comparison views.

    Why look up sport by name in the router, not the service?
    ──────────────────────────────────────────────────────────
    The service function takes a sport_id (UUID) because the service
    layer is transport-agnostic — it shouldn't know that the HTTP API
    uses slugs instead of UUIDs. The router is the translation layer:
    it converts the human-friendly path param into the internal ID
    that the service expects.
    """
    sport = (
        db.query(Sport)
        .filter(Sport.name == sport_name.strip().lower())
        .first()
    )
    if not sport:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sport '{sport_name}' not found",
        )

    return scoring_service.get_default_rules_for_sport(db, sport.id)


# ═══════════════════════════════════════════════════════════════════════════════
# GET /leagues/{league_id}/scoring-overrides — list overrides
# ═══════════════════════════════════════════════════════════════════════════════


@router.get(
    "/leagues/{league_id}/scoring-overrides",
    response_model=list[ScoringOverrideResponse],
    summary="List scoring overrides for a league",
)
def get_overrides(
    league: League = Depends(require_league_member),
    db: Session = Depends(get_db),
):
    """Return all custom scoring overrides for this league.

    Any league MEMBER can view overrides — they need to see
    "how is scoring different in THIS league?" to make informed
    transfer and lineup decisions.
    """
    return scoring_service.get_overrides_for_league(db, league.id)


# ═══════════════════════════════════════════════════════════════════════════════
# POST /leagues/{league_id}/scoring-overrides — create/update override
# ═══════════════════════════════════════════════════════════════════════════════


@router.post(
    "/leagues/{league_id}/scoring-overrides",
    response_model=ScoringOverrideResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Set a scoring override for a league",
)
def create_or_update_override(
    data: ScoringOverrideCreate,
    league: League = Depends(require_league_owner),
    db: Session = Depends(get_db),
):
    """Set (or replace) a custom point value for an action in this league.

    Only the league OWNER can modify scoring rules. This prevents
    members from gaming the system by changing point values mid-season
    to benefit their team.

    The service uses delete+insert (immutable record pattern) — see
    scoring/services.py for the rationale.

    The router commits after the service call returns. If the service
    raises (e.g. action not found in defaults), the transaction is not
    committed and the session auto-rolls-back on next use.
    """
    override = scoring_service.upsert_scoring_override(db, league.id, data)
    db.commit()
    return override


# ═══════════════════════════════════════════════════════════════════════════════
# DELETE /leagues/{league_id}/scoring-overrides/{override_id}
# ═══════════════════════════════════════════════════════════════════════════════


@router.delete(
    "/leagues/{league_id}/scoring-overrides/{override_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Remove a scoring override (revert to default)",
)
def delete_override(
    override_id: UUID,
    league: League = Depends(require_league_owner),
    db: Session = Depends(get_db),
):
    """Remove a scoring override, reverting the action to its default value.

    Only the league OWNER can delete overrides.

    Returns 204 No Content on success (no body). The client already
    knows which override was deleted (it sent the override_id).
    """
    scoring_service.delete_scoring_override(db, league.id, override_id)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

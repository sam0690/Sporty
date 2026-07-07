"""
Scoring router — endpoints for platform-wide default scoring rules.

Auth patterns used:
  - get_current_active_user       → any authenticated, active user
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_active_user
from app.auth.models import User
from app.database import get_db
from app.league.models import Sport
from app.scoring import services as scoring_service
from app.scoring.schemas import ScoringRuleResponse

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

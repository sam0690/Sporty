"""
Scoring service — resolves point values for fantasy actions.

This is the ONLY module that reads scoring data. Routers and other
services call these functions — they never query scoring tables directly.
"""

import uuid

from sqlalchemy.orm import Session, joinedload

from app.scoring.models import DefaultScoringRule


# ═══════════════════════════════════════════════════════════════════════════════
# Default rules (admin)
# ═══════════════════════════════════════════════════════════════════════════════


def get_default_rules_for_sport(
    db: Session,
    sport_id: uuid.UUID,
) -> list[DefaultScoringRule]:
    """Return all default scoring rules for a sport.

    Used by the admin UI to display and manage the canonical rule set.
    Ordered by action for consistent display.
    """
    return (
        db.query(DefaultScoringRule)
        .options(joinedload(DefaultScoringRule.sport))
        .filter(DefaultScoringRule.sport_id == sport_id)
        .order_by(DefaultScoringRule.action)
        .all()
    )

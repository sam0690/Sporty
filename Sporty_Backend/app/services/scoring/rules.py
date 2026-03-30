from __future__ import annotations

import uuid
from dataclasses import dataclass
from decimal import Decimal
from typing import Iterable

from sqlalchemy.orm import Session

from app.scoring.models import DefaultScoringRule, LeagueScoringOverride


@dataclass(frozen=True)
class EffectiveRules:
    league_id: uuid.UUID
    sport_id: uuid.UUID
    points_by_action: dict[str, Decimal]


def to_decimal(value: object, default: Decimal = Decimal("0")) -> Decimal:
    if value is None:
        return default
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def resolve_effective_rules(
    db: Session,
    *,
    league_id: uuid.UUID,
    sport_id: uuid.UUID,
    actions: Iterable[str],
    fallback_points: dict[str, Decimal] | None = None,
) -> EffectiveRules:
    # Algorithm: effective[action] = override if exists else default if exists else fallback/0.
    action_list = [action for action in actions]
    if not action_list:
        return EffectiveRules(league_id=league_id, sport_id=sport_id, points_by_action={})

    default_rows = (
        db.query(DefaultScoringRule.action, DefaultScoringRule.points)
        .filter(DefaultScoringRule.sport_id == sport_id)
        .filter(DefaultScoringRule.action.in_(action_list))
        .all()
    )
    default_map = {action: to_decimal(points) for action, points in default_rows}

    override_rows = (
        db.query(LeagueScoringOverride.action, LeagueScoringOverride.points)
        .filter(LeagueScoringOverride.league_id == league_id)
        .filter(LeagueScoringOverride.sport_id == sport_id)
        .filter(LeagueScoringOverride.action.in_(action_list))
        .all()
    )
    override_map = {action: to_decimal(points) for action, points in override_rows}

    resolved: dict[str, Decimal] = {}
    for action in action_list:
        if action in override_map:
            resolved[action] = override_map[action]
        elif action in default_map:
            resolved[action] = default_map[action]
        elif fallback_points and action in fallback_points:
            resolved[action] = fallback_points[action]
        else:
            resolved[action] = Decimal("0")

    return EffectiveRules(
        league_id=league_id,
        sport_id=sport_id,
        points_by_action=resolved,
    )

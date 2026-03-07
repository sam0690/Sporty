"""
Scoring service — resolves point values for fantasy actions.

Core concept: two-layer lookup.
  1. Check LeagueScoringOverride (league-specific custom points)
  2. Fall back to DefaultScoringRule (platform-wide defaults)

This is the ONLY module that reads scoring data. Routers and other
services call these functions — they never query scoring tables directly.
"""

import logging
import uuid
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.scoring.models import DefaultScoringRule, LeagueScoringOverride
from app.scoring.schemas import ScoringOverrideCreate

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# Point lookup
# ═══════════════════════════════════════════════════════════════════════════════
#
# Q1: get_points_for_action is called once per player per action per
#     gameweek during scoring. In a league with 100 players, each with
#     10 actions per gameweek = 1,000 calls. Each call hits the DB
#     twice in the worst case → up to 2,000 queries per scoring run.
#
#     How to fix: BULK-LOAD ONCE, LOOK UP IN MEMORY.
#
#     Before scoring a gameweek, call build_scoring_lookup() once:
#
#       lookup = build_scoring_lookup(db, league_id, sport_id)
#       # lookup is a dict: {"goal_fwd": Decimal("12.00"), ...}
#
#     Then for every player/action:
#       points = lookup.get(action, Decimal("0.00"))
#
#     This replaces 2,000 DB queries with exactly 2 queries total
#     (one for overrides, one for defaults) regardless of player/action
#     count. The dict merge handles the fallback:
#       1. Load ALL defaults for the sport → dict
#       2. Load ALL overrides for the league+sport → dict
#       3. Merge: defaults | overrides (overrides win)
#
#     The single-lookup function below is still useful for one-off
#     checks (e.g. "what's goal_fwd worth in this league?" in the UI).
#     But the scoring engine should always use build_scoring_lookup().


def get_points_for_action(
    db: Session,
    league_id: uuid.UUID,
    sport_id: uuid.UUID,
    action: str,
) -> Decimal:
    """Resolve the point value for a single action in a league.

    Two-layer lookup:
      1. LeagueScoringOverride (league-specific) → if found, return it.
      2. DefaultScoringRule (platform default)    → if found, return it.
      3. Neither found → log warning, return 0.00.

    For bulk scoring, prefer build_scoring_lookup() instead.
    """
    # Step 1: Check league override
    override = (
        db.query(LeagueScoringOverride)
        .filter(
            LeagueScoringOverride.league_id == league_id,
            LeagueScoringOverride.sport_id == sport_id,
            LeagueScoringOverride.action == action,
        )
        .first()
    )
    if override:
        return override.points

    # Step 2: Fall back to default
    default = (
        db.query(DefaultScoringRule)
        .filter(
            DefaultScoringRule.sport_id == sport_id,
            DefaultScoringRule.action == action,
        )
        .first()
    )
    if default:
        return default.points

    # Step 3: Unknown action — log and return zero
    logger.warning(
        "No scoring rule found: league=%s sport=%s action=%s",
        league_id, sport_id, action,
    )
    return Decimal("0.00")


def build_scoring_lookup(
    db: Session,
    league_id: uuid.UUID,
    sport_id: uuid.UUID,
) -> dict[str, Decimal]:
    """Build an in-memory action→points dict for bulk scoring.

    Loads ALL defaults and ALL overrides in exactly 2 queries,
    then merges them so overrides win. The scoring engine calls
    this once per (league, sport, gameweek) and does dict lookups
    for every player action — zero per-action DB queries.

    Returns:
        {"goal_fwd": Decimal("12.00"), "assist": Decimal("5.00"), ...}
    """
    # Query 1: all defaults for this sport
    defaults = (
        db.query(DefaultScoringRule.action, DefaultScoringRule.points)
        .filter(DefaultScoringRule.sport_id == sport_id)
        .all()
    )

    # Fail fast: a sport with zero defaults means rules were never seeded.
    # Returning {} here would silently score every action as 0 — dangerous.
    if not defaults:
        raise ValueError(
            f"No default scoring rules found for sport_id={sport_id}. "
            "Seed DefaultScoringRule rows before scoring."
        )

    lookup: dict[str, Decimal] = {row.action: row.points for row in defaults}

    # Query 2: all overrides for this league+sport (overwrite defaults)
    overrides = (
        db.query(LeagueScoringOverride.action, LeagueScoringOverride.points)
        .filter(
            LeagueScoringOverride.league_id == league_id,
            LeagueScoringOverride.sport_id == sport_id,
        )
        .all()
    )
    for row in overrides:
        lookup[row.action] = row.points

    return lookup


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


# ═══════════════════════════════════════════════════════════════════════════════
# Override upsert
# ═══════════════════════════════════════════════════════════════════════════════
#
# Why delete+insert instead of UPDATE?
#
#   LeagueScoringOverride is designed as an IMMUTABLE record.
#   Each row's created_at is the audit trail — it tells you exactly
#   when this point value was set.
#
#   If we UPDATE in place:
#     - created_at still shows the original creation time, not when
#       the value changed.
#     - We'd need an updated_at column (which we deliberately omitted —
#       see the design discussion in scoring/models.py).
#     - The old value is lost forever. If someone asks "what was
#       goal_fwd worth last week?", we can't answer.
#
#   With delete+insert:
#     - The old row is gone (or soft-deleted / archived if we want history).
#     - The new row's created_at = the moment the override was set.
#     - Clean, append-style semantics — same pattern as how we handle
#       refresh token rotation (revoke old, create new).
#
#   Future enhancement: instead of DELETE, add an archived_at column
#   and soft-delete. Then you have a full history of every override
#   change. But for v1, hard delete is fine — the scoring engine only
#   needs the current value.
#
# Q2: What happens if delete succeeds but insert fails?
#
#   Without a transaction: the old override is deleted but the new one
#   isn't created → the league falls back to the default rule silently.
#   The league owner thinks they set a custom value, but it's gone.
#   This is a PARTIALLY-APPLIED STATE — the worst kind of bug because
#   it's invisible and produces incorrect scores.
#
#   Solution: the caller (router) provides the db Session, and this
#   function does NOT call db.commit(). Both the DELETE and INSERT
#   happen within the same transaction. If the INSERT fails (e.g.
#   constraint violation), SQLAlchemy rolls back the entire transaction
#   including the DELETE. The old override stays intact.
#
#   This is the same "caller owns the transaction" pattern used in
#   auth/services.py (_build_tokens doesn't commit — register() does).


def upsert_scoring_override(
    db: Session,
    league_id: uuid.UUID,
    data: ScoringOverrideCreate,
) -> LeagueScoringOverride:
    """Set (or replace) a scoring override for a league.

    Delete+insert pattern — see comment block above for rationale.
    Does NOT commit — caller owns the transaction.

    Validates that the action exists in DefaultScoringRule for the
    given sport before creating the override. This prevents league
    owners from creating overrides for non-existent actions.
    """
    # Validate: action must exist in defaults for this sport
    default_exists = (
        db.query(DefaultScoringRule)
        .filter(
            DefaultScoringRule.sport_id == data.sport_id,
            DefaultScoringRule.action == data.action,
        )
        .first()
    )
    if not default_exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No default scoring rule for action '{data.action}' in this sport",
        )

    # Delete existing override (if any) — same transaction
    db.query(LeagueScoringOverride).filter(
        LeagueScoringOverride.league_id == league_id,
        LeagueScoringOverride.sport_id == data.sport_id,
        LeagueScoringOverride.action == data.action,
    ).delete()

    # Insert new override
    override = LeagueScoringOverride(
        league_id=league_id,
        sport_id=data.sport_id,
        action=data.action,
        points=data.points,
    )
    db.add(override)
    db.flush()  # assign id + validate constraints before caller commits

    # Re-load with sport relationship for ScoringOverrideResponse serialisation
    return (
        db.query(LeagueScoringOverride)
        .options(joinedload(LeagueScoringOverride.sport))
        .filter(LeagueScoringOverride.id == override.id)
        .first()
    )


def get_overrides_for_league(
    db: Session,
    league_id: uuid.UUID,
) -> list[LeagueScoringOverride]:
    """Return all scoring overrides for a league.

    Used by the league settings UI. Ordered by sport + action
    for consistent display.
    """
    return (
        db.query(LeagueScoringOverride)
        .options(joinedload(LeagueScoringOverride.sport))
        .filter(LeagueScoringOverride.league_id == league_id)
        .order_by(LeagueScoringOverride.sport_id, LeagueScoringOverride.action)
        .all()
    )


def delete_scoring_override(
    db: Session,
    league_id: uuid.UUID,
    override_id: uuid.UUID,
) -> None:
    """Remove a scoring override, reverting to the default rule.

    Does NOT commit — caller owns the transaction.
    """
    deleted = (
        db.query(LeagueScoringOverride)
        .filter(
            LeagueScoringOverride.id == override_id,
            LeagueScoringOverride.league_id == league_id,
        )
        .delete()
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scoring override not found",
        )

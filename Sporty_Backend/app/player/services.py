"""
Player service — query layer between routers and ORM models.

Every function in this module is a pure query (no mutations).
Players are created by admins / data pipelines, not by end users.
The service layer here is read-only: list, filter, get, stats.
"""

import uuid

from fastapi import HTTPException, status
from sqlalchemy import false
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.league.models import FantasyTeam, LeagueSport, Sport, TeamPlayer
from app.player.models import Player, PlayerGameweekStat, PlayerPriceHistory
from app.player.schemas import PlayerFilter

SUPPORTED_PLAYER_POOL_SPORTS = {"football", "basketball"}


# ═══════════════════════════════════════════════════════════════════════════════
# Internal helpers
# ═══════════════════════════════════════════════════════════════════════════════


def _apply_filters(query, filters: PlayerFilter):
    """Apply optional WHERE clauses to a Player query.

    Extracted so every public function that needs player filtering
    (get_players, get_available_players_for_league) calls this ONE
    place. Adding a new field to PlayerFilter means updating only
    this function — not hunting for duplicate blocks.
    """
    # ── Sport filter (requires a JOIN) ──────────────────────────────
    if filters.sport_name:
        if filters.sport_name not in SUPPORTED_PLAYER_POOL_SPORTS:
            return query.filter(false())
        query = query.join(Sport, Player.sport_id == Sport.id).filter(
            Sport.name == filters.sport_name
        )

    # ── Simple column filters ───────────────────────────────────────
    if filters.position:
        query = query.filter(Player.position == filters.position)

    if filters.real_team:
        query = query.filter(Player.real_team == filters.real_team)

    if filters.is_available is not None:
        query = query.filter(Player.is_available == filters.is_available)

    # ── Cost range ──────────────────────────────────────────────────
    if filters.min_cost is not None:
        query = query.filter(Player.cost >= filters.min_cost)

    if filters.max_cost is not None:
        query = query.filter(Player.cost <= filters.max_cost)

    # ── Text search (case-insensitive LIKE) ─────────────────────────
    if filters.search:
        query = query.filter(Player.name.ilike(f"%{filters.search}%"))

    return query


def _league_supported_sport_ids(db: Session, league_id: uuid.UUID) -> set[uuid.UUID]:
    rows = (
        db.query(LeagueSport.sport_id)
        .join(Sport, LeagueSport.sport_id == Sport.id)
        .filter(
            LeagueSport.league_id == league_id,
            Sport.name.in_(SUPPORTED_PLAYER_POOL_SPORTS),
        )
        .all()
    )
    return {row[0] for row in rows}


def _apply_league_player_pool(query, db: Session, league_id: uuid.UUID):
    allowed_sport_ids = _league_supported_sport_ids(db, league_id)
    if not allowed_sport_ids:
        return query.filter(false())
    return query.filter(Player.sport_id.in_(allowed_sport_ids))


def _exclude_owned_players(query, league_id: uuid.UUID):
    """Exclude players currently active on any team in the league.

    Q2: The owned-player subquery
    ──────────────────────────────
    We need to exclude players that are **currently active** on ANY
    fantasy team in the given league.

    Step 1 — find all fantasy_team IDs in this league:
        select(FantasyTeam.id).where(FantasyTeam.league_id == league_id)

    Step 2 — find all player_ids that are ACTIVE on those teams:
        select(TeamPlayer.player_id).where(
            TeamPlayer.fantasy_team_id.in_(step_1),
            TeamPlayer.released_window_id.is_(None),   # still on roster
        )

    Step 3 — exclude those player_ids from the main query:
        query.filter(Player.id.notin_(step_2))

    Why a subquery instead of a JOIN + IS NULL?
    ────────────────────────────────────────────
    Both produce the same result. A NOT IN (subquery) is easier to
    read and compose on top of an existing query object. PostgreSQL's
    planner typically rewrites NOT IN to an anti-join anyway, so
    performance is equivalent for sensible league sizes.

    SQLAlchemy construct used: .notin_() with a Core select():
        owned_ids = select(TeamPlayer.player_id).where(...)
        query = query.filter(Player.id.notin_(owned_ids))

    This generates:
        WHERE players.id NOT IN (SELECT player_id FROM team_players WHERE ...)
    """
    owned_player_ids = (
        select(TeamPlayer.player_id)
        .where(
            TeamPlayer.fantasy_team_id.in_(
                select(FantasyTeam.id).where(
                    FantasyTeam.league_id == league_id
                )
            ),
            TeamPlayer.released_window_id.is_(None),  # still active
        )
    )
    return query.filter(Player.id.notin_(owned_player_ids))


def _paginate(query, filters: PlayerFilter) -> tuple[list, int]:
    """Count total matches, then apply offset/limit.

    Q1: Why return total_count separately instead of len(players)?
    ───────────────────────────────────────────────────────────────
    len(players) tells you how many rows are on THIS PAGE, not how
    many rows match the filter in total.

    Example: 347 players match "sport=football". Page 1 returns 20.
      len(players) = 20   ← useless for pagination controls
      total_count  = 347  ← the frontend needs this to render
                            "Page 1 of 18" and enable/disable
                            next/prev buttons.

    We run query.count() BEFORE .offset()/.limit() to get the
    un-paginated total. This costs one extra COUNT(*) query, but
    it's cheap (same WHERE, no row materialisation) and gives the
    frontend everything it needs.
    """
    total = query.count()

    offset = (filters.page - 1) * filters.page_size
    rows = (
        query
        .order_by(Player.name)
        .offset(offset)
        .limit(filters.page_size)
        .all()
    )
    return rows, total


# ═══════════════════════════════════════════════════════════════════════════════
# 1. get_players — filtered, paginated player list
# ═══════════════════════════════════════════════════════════════════════════════


def get_players(
    db: Session,
    filters: PlayerFilter,
) -> tuple[list[Player], int]:
    """Return (players, total_count) applying optional filters.

    If filters.league_id is provided, players already owned by any
    team in that league are automatically excluded. This means a
    single GET /players?league_id=... endpoint serves both general
    browsing (no league_id) and transfer/draft pool views (with
    league_id) — no separate endpoint needed.
    """
    query = db.query(Player).options(joinedload(Player.sport))

    # ── League-scoped exclusion (owned players) ─────────────────────
    if filters.league_id:
        query = _apply_league_player_pool(query, db, filters.league_id)
        query = _exclude_owned_players(query, filters.league_id)

    query = _apply_filters(query, filters)
    return _paginate(query, filters)


# ═══════════════════════════════════════════════════════════════════════════════
# 2. get_player — single player by ID
# ═══════════════════════════════════════════════════════════════════════════════


def get_player(db: Session, player_id: uuid.UUID) -> Player:
    """Fetch a single player or raise 404.

    Why raise HTTPException here instead of returning None?
    ────────────────────────────────────────────────────────
    This is a service-layer convention matching the auth module:
    if the router says "give me player X" and X doesn't exist,
    that's always a 404. Raising here avoids duplicating the
    same None-check + raise in every router that calls this.
    """
    player = (
        db.query(Player)
        .options(joinedload(Player.sport))
        .filter(Player.id == player_id)
        .first()
    )
    if not player:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Player not found",
        )
    return player


# ═══════════════════════════════════════════════════════════════════════════════
# 3. get_available_players_for_league — convenience wrapper
# ═══════════════════════════════════════════════════════════════════════════════


def get_available_players_for_league(
    db: Session,
    league_id: uuid.UUID,
    filters: PlayerFilter,
) -> tuple[list[Player], int]:
    """Players NOT currently owned by any team in this league.

    This is the primary query for two user flows:
      • Draft pool  — "which players can I pick?"
      • Transfer in — "which players are free to sign?"

    Delegates to get_players with league_id set, so filtering,
    pagination, and owned-player exclusion all happen in one place.
    Exists as a named entry point for callers that always have a
    league_id (draft service, transfer service) — they shouldn't
    need to know about PlayerFilter internals.
    """
    # Stamp league_id onto the filters and delegate.
    # PlayerFilter is a Pydantic model — .model_copy() gives us an
    # isolated copy so we don't mutate the caller's object.
    scoped = filters.model_copy(update={"league_id": league_id})
    return get_players(db, scoped)


# ═══════════════════════════════════════════════════════════════════════════════
# 4. get_player_stats — single player + gameweek stat with eager children
# ═══════════════════════════════════════════════════════════════════════════════


def get_player_stats(
    db: Session,
    player_id: uuid.UUID,
    gameweek_id: uuid.UUID,
) -> PlayerGameweekStat | None:
    """Return the base stat + eagerly loaded sport-specific child.

    Q3: Why joinedload for football_stat / cricket_stat?
    ─────────────────────────────────────────────────────
    SQLAlchemy relationships are lazy-loaded by default. This means
    accessing stat.football_stat AFTER the query triggers a second
    SELECT behind the scenes.

    That's fine in a plain synchronous session, but:

      1. In an async context (async_session + AsyncSession), lazy
         loads raise MissingGreenlet / DetachedInstanceError because
         SQLAlchemy can't emit implicit IO on the async event loop.

      2. Even in sync mode, N+1 is wasteful. If the router serialises
         the response (Pydantic from_attributes=True), accessing each
         relationship fires a separate query. With eager loading,
         everything arrives in one round-trip.

    joinedload() adds a LEFT OUTER JOIN in the same SELECT so the
    child row (if it exists) is fetched alongside the parent. For a
    1:1 relationship this is the cheapest option — one row, one query.

    Alternative: selectinload() — issues a second SELECT with
    WHERE base_stat_id IN (...). Better for 1:N collections, worse
    for 1:1 since it always costs a second round-trip. We use
    joinedload for the 1:1 case here.

    Returns None if no stat row exists for this player+gameweek
    combination (the player didn't play that week).
    """
    return (
        db.query(PlayerGameweekStat)
        .options(
            joinedload(PlayerGameweekStat.player).joinedload(Player.sport),
            joinedload(PlayerGameweekStat.transfer_window),
            joinedload(PlayerGameweekStat.football_stat),
            joinedload(PlayerGameweekStat.cricket_stat),
        )
        .filter(
            PlayerGameweekStat.player_id == player_id,
            PlayerGameweekStat.transfer_window_id == gameweek_id,
        )
        .first()
    )


def get_player_price_history(
    db: Session,
    player_id: uuid.UUID,
    *,
    limit: int = 20,
) -> list[PlayerPriceHistory]:
    """Return newest-first price history for a player.

    The first query ensures a consistent 404 when player_id is invalid.
    """
    get_player(db, player_id)

    safe_limit = max(1, min(limit, 100))
    return (
        db.query(PlayerPriceHistory)
        .options(joinedload(PlayerPriceHistory.transfer_window))
        .filter(PlayerPriceHistory.player_id == player_id)
        .order_by(PlayerPriceHistory.created_at.desc())
        .limit(safe_limit)
        .all()
    )

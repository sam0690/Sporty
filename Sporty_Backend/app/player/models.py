import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Numeric,
    SmallInteger,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# NOTE: No import of league.models here — would cause circular import.
# All relationships use string-based targets ("Sport", "Gameweek") which
# SQLAlchemy resolves lazily at runtime once all models are registered.


# ═══════════════════════════════════════════════════════════════════════════════
# 1. Player
# ═══════════════════════════════════════════════════════════════════════════════
#
# Q1: real_team — String vs FK to a teams/clubs table?
# A:  String(100) for v1. Here's why:
#
#     FK approach (normalised):
#       + referential integrity, no typos ("Arsenal" vs "arsenal")
#       + you can store club metadata (logo_url, country, etc.)
#       - requires a Club table, a seeding pipeline, and a join on
#         every player query BEFORE we've validated the core product
#       - club names change (e.g. "Twitter FC" → "X FC"), requiring
#         migrations that don't affect fantasy gameplay at all
#
#     String approach (denormalised):
#       + ship faster — no extra table, no seed script, no join
#       + good enough for display purposes ("Manchester United")
#       + easy to migrate later: CREATE TABLE clubs, backfill from
#         DISTINCT(real_team), ALTER player ADD club_id FK, drop column
#       - typos possible — mitigated by admin-only player creation
#         and service-layer validation against a known list
#
#     Decision: String for v1. The cost of normalising later is low
#     (one migration). The cost of premature normalisation is wasted
#     time on a table nobody queries independently yet.
#
# Q: position — String vs Enum?
# A: String. Positions vary wildly across sports ("GKP" in football,
#    "WK" in cricket). An Enum would require a new DB migration every
#    time a sport is added. Validation happens at the app layer
#    (service/schema), not the DB layer.


class Player(Base):
    __tablename__ = "players"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    sport_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sports.id"),
        nullable=False, index=True,
    )

    # External API reference (e.g., player ID from API-Football)
    # Nullable for manually-created players
    external_api_id: Mapped[str | None] = mapped_column(
        String(100), unique=True, nullable=True, index=True
    )

    name: Mapped[str] = mapped_column(String(150), nullable=False)

    # Position code validated at the app layer, not DB Enum.
    # Football: "GKP", "DEF", "MID", "FWD"
    # Cricket:  "BAT", "BOWL", "AR", "WK"
    position: Mapped[str] = mapped_column(String(20), nullable=False)

    # See Q1 above — String for v1, FK to a clubs table later.
    real_team: Mapped[str] = mapped_column(String(100), nullable=False)

    # Current market cost — fluctuates over the season
    cost: Mapped[Decimal] = mapped_column(
        Numeric(precision=10, scale=2), nullable=False
    )

    # Can this player be picked / transferred in?
    # False = injured, suspended, or removed from the game.
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    sport: Mapped["Sport"] = relationship(
        foreign_keys=[sport_id], overlaps="players"
    )
    gameweek_stats: Mapped[list["PlayerGameweekStat"]] = relationship(
        back_populates="player",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        CheckConstraint("cost >= 0", name="ck_player_cost_non_negative"),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 2. PlayerGameweekStat  (base stats — sport-agnostic)
# ═══════════════════════════════════════════════════════════════════════════════
#
# One row per player per transfer window. Contains the universal fields that
# apply to every sport (minutes played, total fantasy points).
#
# Sport-specific stats live in child tables (FootballStat, CricketStat)
# linked via a 1:1 FK. This is the "concrete table inheritance" pattern
# (or more precisely, "table-per-subtype with shared base").
#
# Why not one wide table with nullable columns for every sport?
#   - Hundreds of nullable columns as sports are added.
#   - No way to enforce "goals_scored NOT NULL when sport=football".
#   - Harder to add a new sport (ALTER TABLE vs CREATE TABLE).
#
# Why not STI (Single Table Inheritance)?
#   - Same width problem, plus discriminator logic in every query.
#
# Why this 1:1 child approach?
#   + Base table stays thin and sport-agnostic.
#   + Each child table enforces its own NOT NULL constraints.
#   + Adding a new sport = one new child table, zero changes to base.
#   + Queries can JOIN only the sport they care about.


class PlayerGameweekStat(Base):
    __tablename__ = "player_gameweek_stats"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    player_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("players.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    transfer_window_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("transfer_windows.id"),
        nullable=False, index=True,
    )

    # Universal stat: how many minutes the player was on the field/pitch
    minutes_played: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0
    )

    # Computed total fantasy points for this transfer window (sum of all bonuses
    # and deductions from the sport-specific child table).
    # Stored denormalised for fast leaderboard queries — recomputed by
    # the scoring service whenever child stats are updated.
    fantasy_points: Mapped[Decimal] = mapped_column(
        Numeric(precision=8, scale=2), nullable=False, default=Decimal("0.00")
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    player: Mapped["Player"] = relationship(back_populates="gameweek_stats")
    transfer_window: Mapped["TransferWindow"] = relationship(foreign_keys=[transfer_window_id])
    # 1:1 children — added as they're created
    football_stat: Mapped["FootballStat | None"] = relationship(
        back_populates="base_stat", uselist=False,
        cascade="all, delete-orphan", passive_deletes=True,
    )
    cricket_stat: Mapped["CricketStat | None"] = relationship(
        back_populates="base_stat", uselist=False,
        cascade="all, delete-orphan", passive_deletes=True,
    )
    nba_stat: Mapped["NBAStat | None"] = relationship(
        back_populates="base_stat",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        # One stat row per player per transfer window — no duplicates
        UniqueConstraint(
            "player_id", "transfer_window_id",
            name="uq_player_gameweek_stat",
        ),
        CheckConstraint(
            "minutes_played >= 0",
            name="ck_stat_minutes_non_negative",
        ),
        # 120 = extra time maximum. No player plays more than 120 mins.
        CheckConstraint(
            "minutes_played <= 120",
            name="ck_stat_minutes_max",
        ),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 3. FootballStat  (1:1 child of PlayerGameweekStat)
# ═══════════════════════════════════════════════════════════════════════════════
#
# Q2: Why does UNIQUE on base_stat_id make this one-to-one?
# A:  A FK alone is many-to-one (many FootballStat rows could point to
#     the same PlayerGameweekStat). Adding UNIQUE on base_stat_id means
#     at most ONE FootballStat row can reference a given base stat.
#     FK + UNIQUE = one-to-one at the DB level.
#     On the ORM side, uselist=False on the relationship enforces the
#     same constraint in Python (returns a single object, not a list).
#
# All columns are SmallInteger, NOT NULL, default=0.
# Football stats are always known (even if 0) once the match is played.


class FootballStat(Base):
    __tablename__ = "football_stats"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # 1:1 link to base stat — UNIQUE makes it one-to-one (see Q2)
    base_stat_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("player_gameweek_stats.id", ondelete="CASCADE"),
        unique=True, nullable=False,
    )

    goals: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    assists: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    clean_sheets: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    yellow_cards: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    red_cards: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    own_goals: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    penalties_saved: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    penalties_missed: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    saves: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    goals_conceded: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    bonus: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)

    # Relationship back to base stat
    base_stat: Mapped["PlayerGameweekStat"] = relationship(
        back_populates="football_stat"
    )

    __table_args__ = (
        CheckConstraint("goals >= 0", name="ck_fb_goals"),
        CheckConstraint("assists >= 0", name="ck_fb_assists"),
        CheckConstraint("clean_sheets >= 0", name="ck_fb_clean_sheets"),
        CheckConstraint("yellow_cards >= 0", name="ck_fb_yellow_cards"),
        # A player cannot receive more than 2 yellows in one match
        CheckConstraint("yellow_cards <= 2", name="ck_fb_yellow_cards_max"),
        CheckConstraint("red_cards >= 0", name="ck_fb_red_cards"),
        CheckConstraint("red_cards <= 1", name="ck_fb_red_cards_max"),
        CheckConstraint("own_goals >= 0", name="ck_fb_own_goals"),
        CheckConstraint("penalties_saved >= 0", name="ck_fb_penalties_saved"),
        CheckConstraint("penalties_missed >= 0", name="ck_fb_penalties_missed"),
        CheckConstraint("saves >= 0", name="ck_fb_saves"),
        CheckConstraint("goals_conceded >= 0", name="ck_fb_goals_conceded"),
        CheckConstraint("bonus >= 0", name="ck_fb_bonus"),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 4. CricketStat  (1:1 child of PlayerGameweekStat)
# ═══════════════════════════════════════════════════════════════════════════════
#
# Q3: NULL vs 0.00 for economy_rate (and other cricket stats)?
# A:  NULL. Here's the distinction:
#
#     0.00 means "the player bowled and their economy rate was 0.00"
#         — that's a valid stat (e.g. bowled 1 over, conceded 0 runs).
#
#     NULL means "the player did NOT bowl in this match"
#         — economy_rate is undefined / not applicable.
#
#     If we used 0.00 for "didn't bowl", a leaderboard query like
#     ORDER BY economy_rate ASC would rank non-bowlers above actual
#     bowlers with economy 0.50 — completely wrong.
#
#     NULL is semantically correct: "this stat does not exist for this
#     player in this match". Queries use WHERE economy_rate IS NOT NULL
#     to filter to players who actually bowled.
#
#     Same logic applies to all cricket stat columns — a pure batsman
#     has NULL for wickets_taken, maidens, economy_rate. A pure bowler
#     might have NULL for runs_scored, balls_faced (if they didn't bat).
#     All-rounders have values in both.
#
# All columns are nullable SmallInteger (or Numeric for economy_rate).


class CricketStat(Base):
    __tablename__ = "cricket_stats"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # 1:1 link to base stat — same pattern as FootballStat
    base_stat_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("player_gameweek_stats.id", ondelete="CASCADE"),
        unique=True, nullable=False,
    )

    # Batting stats — NULL if the player did not bat
    runs_scored: Mapped[int | None] = mapped_column(
        SmallInteger, nullable=True
    )
    balls_faced: Mapped[int | None] = mapped_column(
        SmallInteger, nullable=True
    )

    # Bowling stats — NULL if the player did not bowl
    wickets_taken: Mapped[int | None] = mapped_column(
        SmallInteger, nullable=True
    )
    maidens: Mapped[int | None] = mapped_column(
        SmallInteger, nullable=True
    )
    # Numeric(5,2) — e.g. 12.50 runs per over; NULL if didn't bowl (see Q3)
    economy_rate: Mapped[Decimal | None] = mapped_column(
        Numeric(precision=5, scale=2), nullable=True
    )

    # Fielding stats — NULL if not applicable
    catches: Mapped[int | None] = mapped_column(
        SmallInteger, nullable=True
    )
    run_outs: Mapped[int | None] = mapped_column(
        SmallInteger, nullable=True
    )

    # Relationship back to base stat
    base_stat: Mapped["PlayerGameweekStat"] = relationship(
        back_populates="cricket_stat"
    )

    __table_args__ = (
        CheckConstraint(
            "runs_scored IS NULL OR runs_scored >= 0",
            name="ck_cr_runs_scored",
        ),
        CheckConstraint(
            "balls_faced IS NULL OR balls_faced >= 0",
            name="ck_cr_balls_faced",
        ),
        CheckConstraint(
            "wickets_taken IS NULL OR wickets_taken >= 0",
            name="ck_cr_wickets_taken",
        ),
        CheckConstraint(
            "maidens IS NULL OR maidens >= 0",
            name="ck_cr_maidens",
        ),
        CheckConstraint(
            "economy_rate IS NULL OR economy_rate >= 0",
            name="ck_cr_economy_rate",
        ),
        CheckConstraint(
            "catches IS NULL OR catches >= 0",
            name="ck_cr_catches",
        ),
        CheckConstraint(
            "run_outs IS NULL OR run_outs >= 0",
            name="ck_cr_run_outs",
        ),
    )

import enum
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# NOTE: No import of player.models or auth.models here — would cause
# circular imports. All cross-module relationships use string-based
# targets ("Player", "User") which SQLAlchemy resolves lazily at
# runtime once all models are registered via main.py imports.


# ═══════════════════════════════════════════════════════════════════════════════
# 1. Sport
# ═══════════════════════════════════════════════════════════════════════════════
#
# Q: name — "football" or "Football"?
# A: Lowercase, machine-readable slug ("football", "basketball").
#    Used in URLs, API filters, and code comparisons.
#    Avoids casing bugs (is it "Football" or "FOOTBALL"?).
#
# Q: Do you need display_name separate from name?
# A: Yes. `name` is the machine key (unique, lowercase, immutable).
#    `display_name` is the human-facing label ("Football", "Fútbol").
#    Keeps the identifier stable even if the UI label changes.
#
# Q: Do you need is_active?
# A: Yes. Allows soft-disabling a sport (hide from UI, reject new
#    season creation) without CASCADE-deleting all seasons/gameweeks.


class Sport(Base):
    __tablename__ = "sports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Machine-readable slug: "football", "basketball"
    name: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True
    )

    # Human-facing label: "Football", "Baloncesto"
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # One Sport → many Seasons
    # No cascade — sport deletion is blocked by FK if seasons exist.
    # Use is_active=False to "remove" a sport, not DELETE.
    seasons: Mapped[list["Season"]] = relationship(back_populates="sport")
    players: Mapped[list["Player"]] = relationship(foreign_keys="[Player.sport_id]")
    matches: Mapped[list["Match"]] = relationship(back_populates="sport")


# ═══════════════════════════════════════════════════════════════════════════════
# 2. Season
# ═══════════════════════════════════════════════════════════════════════════════
#
# Q: start_date / end_date — Date or DateTime?
# A: Date. A season starts on a DAY (2025-08-15), not at 14:30:00.
#    Gameweeks carry the precise datetime boundaries.
#
# Q: How does the system know which season is CURRENT?
# A: Derived via property: start_date <= today <= end_date.
#    A bool column (is_current) would require manual flipping and
#    can go stale if a cron job fails. Dates are the single source
#    of truth. The property never lies.
#
# Q: Can two seasons (same sport) overlap? What prevents it?
# A: They must NOT overlap. The ideal DB-level fix is a PostgreSQL
#    ExcludeConstraint with btree_gist:
#        EXCLUDE USING gist (sport_id WITH =,
#            daterange(start_date, end_date, '[]') WITH &&)
#    For now we enforce:
#      - CheckConstraint: start_date < end_date (basic sanity)
#      - UniqueConstraint: (sport_id, start_date) — no two seasons
#        for the same sport can start on the same day
#      - UniqueConstraint: (sport_id, name) — no duplicate names
#      - Full overlap prevention at the service layer
#        (query for conflicting date ranges before INSERT).
#    TODO: Enable btree_gist extension and add ExcludeConstraint
#          for bulletproof DB-level overlap prevention.


class Season(Base):
    __tablename__ = "seasons"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    sport_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sports.id"),
        nullable=False, index=True,
    )

    # Human-readable label: "2025/26", "Summer 2025"
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    # Date (not DateTime) — a season starts on a DAY
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)

    # False = cancelled/hidden. Distinct from is_current (date-derived).
    # A season can be is_current=True but is_active=False (cancelled mid-season).
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    sport: Mapped["Sport"] = relationship(back_populates="seasons")
    transfer_windows: Mapped[list["TransferWindow"]] = relationship(
        back_populates="season",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    @property
    def total_windows(self) -> int:
        """Total number of transfer windows in this season."""
        return len(self.transfer_windows)

    @property
    def is_current(self) -> bool:
        """Season is current if today falls within [start_date, end_date]."""
        return self.start_date <= date.today() <= self.end_date

    __table_args__ = (
        CheckConstraint("start_date < end_date", name="ck_season_dates"),
        UniqueConstraint("sport_id", "start_date", name="uq_season_sport_start"),
        UniqueConstraint("sport_id", "name", name="uq_season_sport_name"),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 3. TransferWindow
# ═══════════════════════════════════════════════════════════════════════════════
#
# Q: start_at / end_at — DateTime(timezone=True)?
# A: Yes. Transfer windows have precise boundaries (e.g. Friday 18:00 UTC →
#    Monday 22:00 UTC). Timezone-aware to avoid DST bugs.
#
# Q: is_current — bool column or derived?
# A: Derived via property: start_at <= now <= end_at.
#    Same reasoning as Season — timestamps are the source of truth.
#
# Q: is_locked — what does this mean? When does it flip?
# A: Explicit bool column, NOT derived from time. It means "no more
#    picks or transfers allowed for this transfer window". Flips to True when:
#      - A scheduled job runs at the deadline, OR
#      - An admin manually locks it (e.g. early lock for emergencies).
#    transfers_locked and lineup_locked are explicit bools flipped by
#    a scheduler or admin. They are NOT derived from time — an admin
#    might lock early or extend a deadline.
#
# Q: transfer_deadline_at vs lineup_deadline_at?
# A: Two distinct cutoffs per transfer window:
#    - transfer_deadline_at: last moment to make transfers IN/OUT
#    - lineup_deadline_at:   last moment to change your starting XI
#    Invariant: transfer_deadline_at < lineup_deadline_at <= end_at.
#    Transfers lock first, then lineups lock closer to kickoff.
#
# Q: number — what type? What constraint?
# A: SmallInteger (transfer windows won't exceed 32,767). Must be > 0.
#    UniqueConstraint(season_id, number) — no duplicate window numbers
#    within the same season.
#
# Q: What prevents two transfer windows in the same season from overlapping?
# A: Same approach as Season:
#      - CheckConstraint: start_at < end_at (basic sanity)
#      - UniqueConstraint: (season_id, number) — no duplicate numbers
#      - Full time-range overlap prevention at the service layer.
#    TODO: Enable btree_gist and add ExcludeConstraint for
#          tstzrange(start_at, end_at) overlap prevention.


class TransferWindow(Base):
    __tablename__ = "transfer_windows"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    season_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("seasons.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )

    # Window number within the season (1, 2, 3, …)
    number: Mapped[int] = mapped_column(SmallInteger, nullable=False)

    # Precise timezone-aware boundaries
    start_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    end_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    # Deadline: last moment to make transfers (before lineup_deadline_at)
    transfer_deadline_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    # Deadline: last moment to change starting XI (before end_at)
    lineup_deadline_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    # Explicit bools — flipped by scheduler or admin, not derived from time
    transfers_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    lineup_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    notified: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationship back to season
    season: Mapped["Season"] = relationship(back_populates="transfer_windows")

    # TODO: Add player_stats and weekly_scores relationships
    #       when PlayerGameweekStat and TeamWeeklyScore models are written.

    @property
    def is_current(self) -> bool:
        """Transfer window is current if now falls within [start_at, end_at]."""
        from datetime import timezone
        return self.start_at <= datetime.now(timezone.utc) <= self.end_at

    __table_args__ = (
        CheckConstraint("start_at < end_at", name="ck_transfer_window_times"),
        CheckConstraint(
            "transfer_deadline_at < lineup_deadline_at",
            name="ck_transfer_window_transfer_before_lineup",
        ),
        CheckConstraint(
            "lineup_deadline_at <= end_at",
            name="ck_transfer_window_lineup_before_end",
        ),
        CheckConstraint("number > 0", name="ck_transfer_window_number_positive"),
        UniqueConstraint("season_id", "number", name="uq_transfer_window_season_number"),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 4. LeagueStatus enum
# ═══════════════════════════════════════════════════════════════════════════════
#
# Four lifecycle states:
#   SETUP     → owner is configuring (sports, slots, invites)
#   DRAFTING  → draft is in progress, no more config changes
#   ACTIVE    → season is running, gameweek scoring is live
#   COMPLETED → season ended, league is frozen / read-only


class LeagueStatus(str, enum.Enum):
    SETUP = "setup"
    DRAFTING = "drafting"
    ACTIVE = "active"
    COMPLETED = "completed"


# ═══════════════════════════════════════════════════════════════════════════════
# 5. League
# ═══════════════════════════════════════════════════════════════════════════════
#
# Q1: invite_code — where is it generated?
# A:  In the SERVICE layer, not the model or router.
#     - Router: handles HTTP — shouldn't contain business logic.
#     - Model (default=): runs at Python object creation, BEFORE validation.
#       If we later need uniqueness-retry logic (collision on short codes)
#       or want to regenerate codes, a column default can't do that.
#     - Service: the right place. It can retry on collision, call
#       secrets.token_urlsafe(), or let the admin supply a custom code.
#     Invite code is 8 chars from secrets.token_urlsafe(6) (yields ~8
#     URL-safe chars). Short enough to share verbally, long enough
#     that brute-forcing is impractical (64^8 ≈ 2.8 × 10^14).
#
# Q: name — unique per owner? or globally unique?
# A: Unique per season. Two different seasons can have "My League".
#    Same season cannot. UniqueConstraint(season_id, name).
#
# Q: max_teams default?
# A: 10 — standard fantasy league size. Configurable per league.


class League(Base):
    __tablename__ = "leagues"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # The user who created and administers this league
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"),
        nullable=False, index=True,
    )

    # Which season this league runs in
    season_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("seasons.id"),
        nullable=False, index=True,
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False)

    # Short, shareable join code — generated in the service layer
    # (see Q1 answer above)
    invite_code: Mapped[str] = mapped_column(
        String(16), unique=True, nullable=False, index=True
    )

    status: Mapped[LeagueStatus] = mapped_column(
        SAEnum(LeagueStatus, name="leaguestatus_enum"),
        nullable=False, default=LeagueStatus.SETUP,
    )

    # Optional lifecycle boundaries used by scheduled status automation.
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    max_teams: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=10)

    # Q2: budget_per_team — why Numeric and not Float?
    # A:  Float uses IEEE 754 binary fractions. 0.1 + 0.2 = 0.30000…04.
    #     For money / budget values, that's unacceptable — a player could
    #     cost 7.5 but 100.0 - 92.5 ≠ 7.5 in float math.
    #     Numeric(precision=12, scale=2) stores exact decimals.
    #     Python's Decimal type round-trips cleanly through SQLAlchemy.
    #     12 digits total, 2 after the decimal → up to 9,999,999,999.99.
    budget_per_team: Mapped[Decimal] = mapped_column(
        Numeric(precision=12, scale=2), nullable=False, default=Decimal("100.00")
    )

    squad_size: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=15)

    # Draft mode toggle — False = budget-based, True = draft-based
    # When draft_mode=False, users build teams directly with budget constraints
    # When draft_mode=True, users participate in a snake draft to build teams
    draft_mode: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Transfer economy settings (applies to budget-mode leagues)
    # Number of transfers allowed per transfer window (hard cap, no penalty system)
    transfers_per_window: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=4
    )
    
    # Day of week when transfer window opens (1=Monday, 7=Sunday)
    # Transfer window is a single day each week where teams can make transfers
    transfer_day: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=1
    )

    # True = anyone with the invite code can join; False = invite-only
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)

    # Budget-mode only: allow new members to join after league is ACTIVE.
    allow_midseason_join: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    owner: Mapped["User"] = relationship(foreign_keys=[owner_id])
    season: Mapped["Season"] = relationship(foreign_keys=[season_id])
    sports: Mapped[list["LeagueSport"]] = relationship(
        back_populates="league",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    lineup_slots: Mapped[list["LineupSlot"]] = relationship(
        back_populates="league",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    memberships: Mapped[list["LeagueMembership"]] = relationship(
        back_populates="league",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    fantasy_teams: Mapped[list["FantasyTeam"]] = relationship(
        back_populates="league",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    @property
    def member_count(self) -> int:
        return len(self.memberships)

    @property
    def team_count(self) -> int:
        return len(self.fantasy_teams)

    @property
    def teams_detail(self) -> list[dict]:
        joined_at_by_user_id = {
            membership.user_id: membership.joined_at
            for membership in self.memberships
        }

        return [
            {
                "team_name": team.name,
                "team_owner": team.user,
                "joined_at": joined_at_by_user_id.get(team.user_id, team.created_at),
            }
            for team in self.fantasy_teams
        ]

    __table_args__ = (
        CheckConstraint("max_teams >= 2", name="ck_league_max_teams"),
        CheckConstraint("squad_size >= 1", name="ck_league_squad_size"),
        CheckConstraint("budget_per_team > 0", name="ck_league_budget_positive"),
        CheckConstraint("transfers_per_window >= 0", name="ck_league_transfers_per_window"),
        CheckConstraint("transfer_day >= 1 AND transfer_day <= 7", name="ck_league_transfer_day"),
        UniqueConstraint("season_id", "name", name="uq_league_season_name"),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 6. LeagueSport (join table — League ↔ Sport)
# ═══════════════════════════════════════════════════════════════════════════════
#
# Composite PK (league_id, sport_id) — no surrogate UUID needed.
# A league might cover football + cricket (multi-sport league).
#
# Cascade direction:
#   - League deleted → its LeagueSport rows should be removed (CASCADE).
#   - Sport deleted  → should be BLOCKED if any league references it.
#     Sports are soft-disabled (is_active=False), not deleted.


class LeagueSport(Base):
    __tablename__ = "league_sports"

    league_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leagues.id", ondelete="CASCADE"),
        primary_key=True,
    )
    sport_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sports.id"),  # no CASCADE — block sport deletion
        primary_key=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    league: Mapped["League"] = relationship(back_populates="sports")
    sport: Mapped["Sport"] = relationship()


# ═══════════════════════════════════════════════════════════════════════════════
# 7. LineupSlot
# ═══════════════════════════════════════════════════════════════════════════════
#
# Defines per-league, per-sport position requirements.
# E.g. league X, football: min 1 GKP, max 1 GKP; min 3 DEF, max 5 DEF.
# The service layer validates a user's squad against these rules.


class LineupSlot(Base):
    __tablename__ = "lineup_slots"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    league_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leagues.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    sport_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sports.id"),
        nullable=False, index=True,
    )

    # Position code: "GKP", "DEF", "MID", "FWD", "BAT", "BOWL", etc.
    position: Mapped[str] = mapped_column(String(20), nullable=False)

    min_count: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    max_count: Mapped[int] = mapped_column(SmallInteger, nullable=False)

    # Relationship
    league: Mapped["League"] = relationship(back_populates="lineup_slots")
    sport: Mapped["Sport"] = relationship()

    __table_args__ = (
        CheckConstraint("min_count >= 0", name="ck_lineup_min_count"),
        CheckConstraint("min_count <= max_count", name="ck_lineup_min_le_max"),
        UniqueConstraint(
            "league_id", "sport_id", "position",
            name="uq_lineup_league_sport_position",
        ),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 8. LeagueMembership
# ═══════════════════════════════════════════════════════════════════════════════
#
# Q3: draft_position UNIQUE constraint with multiple NULLs.
# A:  PostgreSQL treats NULLs as distinct in UNIQUE constraints, so
#     multiple rows with draft_position=NULL are perfectly valid. ✅
#     This matches our domain: before the draft starts, every member
#     has NULL draft_position — no conflict.
#
#     ⚠️ SQLite (often used for testing) behaves the same way since 3.9+.
#     BUT MySQL treats NULLs as equal in UNIQUE constraints — meaning
#     only ONE row could have draft_position=NULL. If we ever ran tests
#     against MySQL, the constraint would break as soon as a second
#     member joins without a draft position.
#     Mitigation: always test against PostgreSQL (use testcontainers
#     or a dedicated test DB), not SQLite or MySQL.


class LeagueMembership(Base):
    __tablename__ = "league_memberships"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    league_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leagues.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False, index=True,
    )

    # NULL = not yet assigned; populated when admin starts the draft
    draft_position: Mapped[int | None] = mapped_column(
        SmallInteger, nullable=True
    )

    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # NULL = immediately eligible for scoring (setup/draft join).
    # Non-NULL = first transfer window where this member becomes eligible
    # for points (late join in active budget leagues).
    eligible_from_window_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("transfer_windows.id"),
        nullable=True,
        index=True,
    )

    # Relationships
    league: Mapped["League"] = relationship(back_populates="memberships")
    user: Mapped["User"] = relationship(foreign_keys=[user_id])
    eligible_from_window: Mapped["TransferWindow | None"] = relationship(
        foreign_keys=[eligible_from_window_id]
    )

    __table_args__ = (
        UniqueConstraint("league_id", "user_id", name="uq_membership_league_user"),
        # PostgreSQL allows multiple NULLs here — see Q3 comment above
        UniqueConstraint(
            "league_id", "draft_position",
            name="uq_membership_league_draft_pos",
        ),
        CheckConstraint("draft_position > 0", name="ck_membership_draft_pos"),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 9. FantasyTeam
# ═══════════════════════════════════════════════════════════════════════════════
#
# One user has one team per league. The team holds a budget that starts
# at League.budget_per_team and fluctuates as players are acquired/released.
#
# current_budget lives HERE, not on League, because:
#   - Each team's budget diverges after the draft.
#   - League.budget_per_team is the STARTING template.
#   - FantasyTeam.current_budget is the LIVE balance.


class FantasyTeam(Base):
    __tablename__ = "fantasy_teams"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    league_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leagues.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False, index=True,
    )

    name: Mapped[str] = mapped_column(String(100), nullable=False)

    # Live budget — initialised to League.budget_per_team at draft time.
    # Decreases when acquiring players, increases when releasing them.
    current_budget: Mapped[Decimal] = mapped_column(
        Numeric(precision=10, scale=2), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    league: Mapped["League"] = relationship(back_populates="fantasy_teams")
    user: Mapped["User"] = relationship(foreign_keys=[user_id])
    team_players: Mapped[list["TeamPlayer"]] = relationship(
        back_populates="fantasy_team",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    transfers: Mapped[list["Transfer"]] = relationship(
        back_populates="fantasy_team",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    budget_transactions: Mapped[list["BudgetTransaction"]] = relationship(
        back_populates="fantasy_team",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        UniqueConstraint("league_id", "user_id", name="uq_team_league_user"),
        CheckConstraint("current_budget >= 0", name="ck_team_budget_non_negative"),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 10. TeamPlayer
# ═══════════════════════════════════════════════════════════════════════════════
#
# Tracks which players are on a fantasy team, when they were acquired,
# and (optionally) when they were released.
#
# released_gameweek_id = NULL means the player is still on the team.
# When dropped, set released_gameweek_id to the gameweek of the release.
# This gives full acquisition/release history per team.


class TeamPlayer(Base):
    __tablename__ = "team_players"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    fantasy_team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fantasy_teams.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    # FK to players table
    player_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("players.id"),
        nullable=False, index=True,
    )

    # When was the player acquired? (draft pick or transfer in)
    acquired_window_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("transfer_windows.id"),
        nullable=False,
    )
    # When was the player released? NULL = still on the team.
    released_window_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("transfer_windows.id"),
        nullable=True,
    )

    # Snapshot of the player's cost at the time of acquisition
    cost_at_acquisition: Mapped[Decimal] = mapped_column(
        Numeric(precision=10, scale=2), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    fantasy_team: Mapped["FantasyTeam"] = relationship(back_populates="team_players")
    player: Mapped["Player"] = relationship(foreign_keys=[player_id])
    acquired_window: Mapped["TransferWindow"] = relationship(
        foreign_keys=[acquired_window_id]
    )
    released_window: Mapped["TransferWindow | None"] = relationship(
        foreign_keys=[released_window_id]
    )

    @property
    def is_active(self) -> bool:
        """Player is currently on the team if not released."""
        return self.released_window_id is None

    __table_args__ = (
        # A player can only be acquired once per transfer window per team
        # (prevents duplicate draft picks or double-transfers)
        UniqueConstraint(
            "fantasy_team_id", "player_id", "acquired_window_id",
            name="uq_team_player_acquired",
        ),
        CheckConstraint(
            "cost_at_acquisition >= 0",
            name="ck_team_player_cost_non_negative",
        ),
        # A player cannot be ACTIVE on the same team twice simultaneously.
        # released_window_id IS NULL means the player is still on the roster.
        # This partial unique index only covers active (unreleased) rows,
        # so historical rows (released_window_id IS NOT NULL) don't conflict.
        Index(
            "uix_team_player_active",
            "fantasy_team_id", "player_id",
            unique=True,
            postgresql_where=text("released_window_id IS NULL"),
        ),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 11. Transfer
# ═══════════════════════════════════════════════════════════════════════════════
#
# Immutable audit log of every transfer (player swap) a team makes.
# Each row = one transfer event: player_out leaves, player_in arrives.
#
# In budget-mode leagues (draft_mode=False):
#   - Transfers are capped at League.transfers_per_window (hard cap)
#   - No penalty points system — just a limit on how many transfers you can make
#
# cost_at_transfer: snapshot of the incoming player's price at the time
# of the transfer. Prices may change week-to-week, so we freeze the value.


class Transfer(Base):
    __tablename__ = "transfers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    fantasy_team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fantasy_teams.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    transfer_window_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("transfer_windows.id"),
        nullable=False, index=True,
    )

    # The player being dropped
    player_out_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("players.id"),
        nullable=False,
    )
    # The player being brought in
    player_in_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("players.id"),
        nullable=False,
    )

    # Snapshot of incoming player's cost at time of transfer
    cost_at_transfer: Mapped[Decimal] = mapped_column(
        Numeric(precision=10, scale=2), nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    fantasy_team: Mapped["FantasyTeam"] = relationship(back_populates="transfers")
    transfer_window: Mapped["TransferWindow"] = relationship(foreign_keys=[transfer_window_id])
    player_out: Mapped["Player"] = relationship(foreign_keys=[player_out_id])
    player_in: Mapped["Player"] = relationship(foreign_keys=[player_in_id])

    __table_args__ = (
        CheckConstraint(
            "player_out_id != player_in_id",
            name="ck_transfer_different_players",
        ),
        CheckConstraint(
            "cost_at_transfer >= 0",
            name="ck_transfer_cost_non_negative",
        ),
        # Composite index for the most frequent transfer query:
        #   "How many transfers has this team made this transfer window?"
        # This runs on EVERY transfer attempt to check transfer limits.
        # Without it, Postgres does a sequential scan filtered by two columns.
        Index(
            "ix_transfer_team_window",
            "fantasy_team_id", "transfer_window_id",
        ),
    )


class BudgetTransaction(Base):
    __tablename__ = "budget_transactions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    fantasy_team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fantasy_teams.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    player_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("players.id"),
        nullable=True,
        index=True,
    )

    transfer_window_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("transfer_windows.id"),
        nullable=True,
        index=True,
    )

    transaction_type: Mapped[str] = mapped_column(String(30), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(precision=10, scale=2), nullable=False)
    penalty_applied: Mapped[Decimal] = mapped_column(
        Numeric(precision=10, scale=2),
        nullable=False,
        default=Decimal("0.00"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    fantasy_team: Mapped["FantasyTeam"] = relationship(back_populates="budget_transactions")
    player: Mapped["Player | None"] = relationship(foreign_keys=[player_id])
    transfer_window: Mapped["TransferWindow | None"] = relationship(foreign_keys=[transfer_window_id])

    __table_args__ = (
        CheckConstraint("amount >= 0", name="ck_budget_tx_amount_non_negative"),
        CheckConstraint("penalty_applied >= 0", name="ck_budget_tx_penalty_non_negative"),
        CheckConstraint(
            "transaction_type IN ('purchase', 'discard', 'transfer_out_refund', 'transfer_in_cost')",
            name="ck_budget_tx_type_allowed",
        ),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 10. TeamGameweekLineup
# ═══════════════════════════════════════════════════════════════════════════════
#
# Who STARTS each transfer window. Separate from TeamPlayer (who you OWN).
# You pick 11 starters from your 15-player squad before lineup_deadline_at.
#
# Q1: How do you enforce only ONE captain per team per transfer window
#     at the DB level?
#
# A: A simple CHECK constraint CANNOT enforce "at most one row with
#    is_captain=True for a given (fantasy_team_id, transfer_window_id)".
#    CHECK constraints operate on a SINGLE ROW — they have no visibility
#    into other rows in the table.
#
#    What CAN work at the DB level:
#
#    PostgreSQL partial unique index:
#      CREATE UNIQUE INDEX uq_one_captain_per_team_window
#        ON team_gameweek_lineups (fantasy_team_id, transfer_window_id)
#        WHERE is_captain = TRUE;
#
#    This guarantees at most ONE row with is_captain=True per
#    (fantasy_team_id, transfer_window_id). Same pattern for is_vice_captain.
#
#    However, SQLAlchemy's declarative UniqueConstraint doesn't support
#    partial indexes natively. You'd add it via:
#      Index("uq_one_captain_per_team_window",
#            "fantasy_team_id", "transfer_window_id",
#            unique=True, postgresql_where=text("is_captain = TRUE"))
#
#    For v1 we enforce this at the SERVICE LAYER:
#      - Before setting is_captain=True, clear any existing captain
#        for that team+transfer window.
#      - Wrap in a transaction so it's atomic.
#
#    The partial unique indexes below act as a safety net to catch bugs.
#    If the service layer ever fails to clear the old captain, the DB
#    will reject the INSERT/UPDATE with a unique violation.
#
#    What we CAN enforce with a CHECK constraint (single-row):
#      A player cannot be BOTH captain AND vice-captain on the same row.


class TeamGameweekLineup(Base):
    __tablename__ = "team_gameweek_lineups"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    fantasy_team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fantasy_teams.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    transfer_window_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("transfer_windows.id"),
        nullable=False, index=True,
    )
    player_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("players.id"),
        nullable=False,
    )

    is_captain: Mapped[bool] = mapped_column(Boolean, default=False)
    is_vice_captain: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relationships
    fantasy_team: Mapped["FantasyTeam"] = relationship(foreign_keys=[fantasy_team_id])
    transfer_window: Mapped["TransferWindow"] = relationship(foreign_keys=[transfer_window_id])
    player: Mapped["Player"] = relationship(foreign_keys=[player_id])

    __table_args__ = (
        # A player can only appear once in a team's lineup per transfer window
        UniqueConstraint(
            "fantasy_team_id", "transfer_window_id", "player_id",
            name="uq_lineup_team_window_player",
        ),
        # Single-row check: can't be BOTH captain AND vice-captain
        CheckConstraint(
            "NOT (is_captain AND is_vice_captain)",
            name="ck_lineup_not_captain_and_vice",
        ),
        # Partial unique indexes: at most ONE captain and ONE vice-captain
        # per team per transfer window (DB-level safety net for service layer logic)
        Index(
            "uq_one_captain_per_team_window",
            "fantasy_team_id", "transfer_window_id",
            unique=True,
            postgresql_where=text("is_captain = TRUE"),
        ),
        Index(
            "uq_one_vice_captain_per_team_window",
            "fantasy_team_id", "transfer_window_id",
            unique=True,
            postgresql_where=text("is_vice_captain = TRUE"),
        ),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 11. TeamWeeklyScore
# ═══════════════════════════════════════════════════════════════════════════════
#
# Denormalised score per team per transfer window.
# Computed by the scoring service after all matches in a transfer window finish.
# Stored for fast leaderboard queries — not recomputed on every request.
#
# Q2: Why store rank_in_league instead of computing it on the fly?
#
# A: Trade-off is WRITE cost vs READ cost.
#
#    Computing on the fly means:
#      SELECT *, RANK() OVER (ORDER BY total_points DESC)
#      FROM team_weekly_scores WHERE transfer_window_id = :tw
#    For a single league with 10-20 teams, this is trivial.
#    But consider the real access patterns:
#
#    1. LEADERBOARD PAGE: Every user visits the leaderboard every week.
#       That's N users × W windows × the RANK() window function.
#       With 1000 leagues × 20 teams × 38 windows, that's a LOT of
#       repeated window function calls for data that never changes after
#       the transfer window ends.
#
#    2. HISTORICAL VIEWS: "Show me Window 12 standings" — if rank isn't stored,
#       you recompute a window function over stale data every time.
#
#    3. COMPOSITE QUERIES: "Show teams ranked #1 in any window" or
#       "average rank across all windows" become expensive multi-pass
#       queries without a stored rank column.
#
#    Storing rank_in_league:
#      - Written ONCE after the window scoring job finishes (cheap).
#      - Read on every leaderboard view (O(1) lookup, no window function).
#      - rank_in_league is NULL until the ranking job runs,
#        so you know if rankings are finalized or not.
#
#    The trade-off: rank can become stale if points are retroactively
#    corrected (e.g. stat corrections). Solution: re-run the ranking job
#    after corrections, which updates rank_in_league for affected windows.
#
#    In short: compute-once-read-many beats compute-on-every-read.


class TeamWeeklyScore(Base):
    __tablename__ = "team_weekly_scores"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    fantasy_team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fantasy_teams.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    transfer_window_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("transfer_windows.id"),
        nullable=False, index=True,
    )

    # Total fantasy points for this team in this transfer window
    points: Mapped[Decimal] = mapped_column(
        Numeric(precision=8, scale=2), nullable=False
    )

    # NULL until the ranking job runs after transfer window ends
    rank_in_league: Mapped[int | None] = mapped_column(
        SmallInteger, nullable=True
    )

    # Relationships
    fantasy_team: Mapped["FantasyTeam"] = relationship(foreign_keys=[fantasy_team_id])
    transfer_window: Mapped["TransferWindow"] = relationship(foreign_keys=[transfer_window_id])

    __table_args__ = (
        # One score row per team per transfer window
        UniqueConstraint(
            "fantasy_team_id", "transfer_window_id",
            name="uq_weekly_score_team_window",
        ),
        # rank_in_league is nullable (NULL until ranking job runs).
        # PostgreSQL CHECK treats NULL as "not false" (passes), so
        # `rank_in_league >= 1` alone would technically allow NULLs through.
        # Being explicit with the OR makes the intent crystal clear to
        # future developers: NULL is intentional, not an oversight.
        CheckConstraint(
            "rank_in_league IS NULL OR rank_in_league >= 1",
            name="ck_weekly_score_rank_positive",
        ),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 12. DraftPick
# ═══════════════════════════════════════════════════════════════════════════════
#
# Permanent, immutable record of every pick made during the draft.
# Never updated — append only.
#
# Q3: What are the TWO unique constraints and why?
#
# A: 1. UNIQUE(league_id, pick_number)
#       pick_number is the OVERALL sequential pick across the entire draft
#       (1, 2, 3, ..., N). No two teams can occupy the same pick slot.
#       This is the draft order — pick #1 is first overall, pick #2
#       is second overall, etc. Duplicating a pick_number would mean
#       two teams picked at the same position, which is impossible.
#
#    2. UNIQUE(league_id, player_id)
#       A player can only be drafted ONCE per league. If player "Messi"
#       is picked by Team A, Team B cannot also draft Messi in the same
#       league. Without this constraint, two teams could "own" the same
#       player, breaking squad exclusivity.
#
#    Why NOT UNIQUE(league_id, fantasy_team_id, round_number)?
#       Because that's implied by the draft structure: each team picks
#       exactly once per round, and pick_number already encodes the
#       (round, team) combination. Adding it would be redundant.
#       But pick_number alone doesn't prevent a player being drafted twice —
#       that's why you need BOTH constraints.


class DraftPick(Base):
    __tablename__ = "draft_picks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # CASCADE — draft picks die with the league
    league_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leagues.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    # CASCADE — if the fantasy team is removed, so are its picks
    fantasy_team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fantasy_teams.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    player_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("players.id"),
        nullable=False,
    )

    round_number: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    # Overall pick number across ALL rounds (1, 2, 3, ... N)
    pick_number: Mapped[int] = mapped_column(SmallInteger, nullable=False)

    picked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    league: Mapped["League"] = relationship(foreign_keys=[league_id])
    fantasy_team: Mapped["FantasyTeam"] = relationship(foreign_keys=[fantasy_team_id])
    player: Mapped["Player"] = relationship(foreign_keys=[player_id])

    __table_args__ = (
        # 1. No two picks can have the same position in the draft
        UniqueConstraint(
            "league_id", "pick_number",
            name="uq_draft_pick_league_pick_number",
        ),
        # 2. A player can only be drafted once per league
        UniqueConstraint(
            "league_id", "player_id",
            name="uq_draft_pick_league_player",
        ),
        CheckConstraint("round_number >= 1", name="ck_draft_round_positive"),
        CheckConstraint("pick_number >= 1", name="ck_draft_pick_positive"),
    )

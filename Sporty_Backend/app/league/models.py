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
    JSON,
    Numeric,
    SmallInteger,
    String,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ExcludeConstraint, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

DEFAULT_TEAM_BUDGET = Decimal("100.00")

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
    real_teams: Mapped[list["RealTeam"]] = relationship(foreign_keys="[RealTeam.sport_id]")
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
#    DB-level enforcement: ExcludeConstraint excl_season_sport_no_overlap
#    (migration b2c3d4e5f6a7).  Service-layer check kept as a second layer.


class Season(Base):
    __tablename__ = "seasons"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Nullable ONLY for "unified" multisport seasons — a Season whose dates are
    # the overlap window of two+ sports' seasons (later start → earlier end),
    # under which a multisport league schedules lineups/transfers/scoring with
    # its own independent gameweek numbering. sport_id IS NULL is the
    # discriminator: a real-sport season always has a sport_id; a unified season
    # never does. See docs/UNIFIED_MULTISPORT_SCHEDULE_PLAN.md.
    sport_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sports.id"),
        nullable=True, index=True,
    )

    # For UNIFIED seasons only (sport_id IS NULL): the sports this schedule
    # composes, as a list of sport UUID strings. Display + admin UX only
    # ("Football + Basketball 2026/27") and to record which sports' seasons the
    # overlap dates were derived from — it is NEVER read by scoring, which is
    # driven entirely by each league's own LeagueSport.season_id mappings. NULL
    # for real-sport seasons. No FK integrity (JSONB) — sports are a tiny static
    # set. See docs/UNIFIED_MULTISPORT_SCHEDULE_PLAN.md §6.
    component_sport_ids: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    # Human-readable label: "2025/26", "Summer 2025"
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    # Date (not DateTime) — a season starts on a DAY
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)

    # False = cancelled/hidden. Distinct from is_current (date-derived).
    # A season can be is_current=True but is_active=False (cancelled mid-season).
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Weekday transfer windows are generated on (1=Monday..7=Sunday). Null
    # until an admin generates windows for this season — every league on the
    # season shares this one schedule (see generate_transfer_windows_for_season
    # in app/services/transfer_window_service.py). Not the League-level
    # transfer_day field, which only ever affected the first league to
    # generate and is no longer read.
    transfer_day: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)

    # Human-facing cross-sport cycle label (e.g. "2026/27"), set deliberately
    # by an admin. Display/admin-UX only — NEVER read by cross-sport matching
    # logic (see LeagueSport.season_id / app/services/scoring/window_locator.py),
    # which is the actual source of truth for "which season pairs with which."
    label: Mapped[str | None] = mapped_column(String(20), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships. Optional: a unified multisport season has no owning sport
    # (sport_id IS NULL) — sport is None there. Season.sport_name already guards.
    sport: Mapped["Sport | None"] = relationship(back_populates="seasons")

    @property
    def sport_name(self) -> str | None:
        """Display name of the owning sport — SeasonResponse exposes it so
        clients never have to resolve sport_id themselves (the admin seasons
        page showed raw UUIDs for sports absent from /leagues/sports, which
        filters to league-playable sports only)."""
        return self.sport.display_name if self.sport else None
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

    @property
    def status(self) -> str:
        """upcoming | running | finished — derived from the same dates as
        is_current. Not stored; can never drift from the calendar."""
        today = date.today()
        if today < self.start_date:
            return "upcoming"
        if today > self.end_date:
            return "finished"
        return "running"

    __table_args__ = (
        CheckConstraint("start_date < end_date", name="ck_season_dates"),
        CheckConstraint(
            "transfer_day IS NULL OR (transfer_day >= 1 AND transfer_day <= 7)",
            name="ck_season_transfer_day",
        ),
        UniqueConstraint("sport_id", "start_date", name="uq_season_sport_start"),
        UniqueConstraint("sport_id", "name", name="uq_season_sport_name"),
        ExcludeConstraint(
            (text("daterange(start_date, end_date, '[]')"), "&&"),
            (text("sport_id"), "="),
            using="gist",
            name="excl_season_sport_no_overlap",
        ),
        # The three constraints above all key off sport_id, so none of them
        # protect UNIFIED seasons (sport_id IS NULL): SQL NULL is never equal to
        # NULL, so two unified rows never collide on name/start_date and the
        # GIST exclude's `sport_id WITH =` never yields TRUE for NULL pairs. We
        # add ONE partial guard — unique name among unified seasons — so an
        # admin can't create "Football+Basketball 2026/27" twice. We deliberately
        # do NOT add a date-overlap exclude for unified rows: two different
        # unified seasons (football+basketball vs football+cricket) may legitimately
        # run at the same time. See docs/UNIFIED_MULTISPORT_SCHEDULE_PLAN.md §1.
        Index(
            "uq_unified_season_name",
            "name",
            unique=True,
            postgresql_where=text("sport_id IS NULL"),
            # sqlite_where too, so throwaway-SQLite tests get the SAME partial
            # index and not a full unique-on-name (which would reject two
            # real-sport seasons that legitimately share a name across sports).
            sqlite_where=text("sport_id IS NULL"),
        ),
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
#    DB-level enforcement: ExcludeConstraint excl_transfer_window_season_no_overlap
#    (migration b2c3d4e5f6a7).  Service-layer check kept as a second layer.


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
        ExcludeConstraint(
            (text("tstzrange(start_at, end_at, '[]')"), "&&"),
            (text("season_id"), "="),
            using="gist",
            name="excl_transfer_window_season_no_overlap",
        ),
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


class LeagueMembershipStatus(str, enum.Enum):
    ACTIVE = "active"
    LEFT = "left"


class FantasyTeamStatus(str, enum.Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


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
        Numeric(precision=12, scale=2), nullable=False, default=DEFAULT_TEAM_BUDGET
    )

    squad_size: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=15)

    # Draft mode toggle — False = budget-based, True = draft-based
    # When draft_mode=False, users build teams directly with budget constraints
    # When draft_mode=True, users participate in a snake draft to build teams
    draft_mode: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Live draft room clock. Commissioner-configurable at creation (draft-mode
    # only); mandatory once DRAFTING — no opt-out of having a clock.
    draft_pick_seconds: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=90
    )

    # Absolute deadline for the CURRENT pick (next_pick_number from
    # get_current_draft_turn). NULL when not DRAFTING. Read as an absolute
    # instant, never a duration, so client clock drift / backgrounded tabs
    # don't matter — the frontend just diffs against Date.now(). Recomputed
    # by _advance_draft_clock() on every pick, not derived on read.
    draft_pick_deadline_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Head-to-head format — orthogonal to draft_mode. When True, teams are
    # paired against one opponent per transfer window (see LeagueMatchup /
    # app/services/matchup_service.py) and standings rank by W-L-T record
    # instead of pure cumulative points. See docs/HEAD_TO_HEAD_MATCHUPS.md.
    is_head_to_head: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

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

    # Season-rollover lineage: shared across every League row spawned from
    # the same original league via renew_league(). Not a FK — just a tag
    # identifying "this recurring league" across years. A freshly created
    # league is its own lineage head: season_group_id == id, season_number == 1.
    season_group_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    season_number: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=1
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
        return sum(
            1
            for membership in self.memberships
            if membership.status == LeagueMembershipStatus.ACTIVE
        )

    @property
    def team_count(self) -> int:
        return sum(
            1
            for team in self.fantasy_teams
            if team.status == FantasyTeamStatus.ACTIVE
        )

    @property
    def teams_detail(self) -> list[dict]:
        joined_at_by_user_id = {
            membership.user_id: membership.joined_at
            for membership in self.memberships
            if membership.status == LeagueMembershipStatus.ACTIVE
        }

        return [
            {
                "team_name": team.name,
                "team_owner": team.user,
                "joined_at": joined_at_by_user_id.get(team.user_id, team.created_at),
            }
            for team in self.fantasy_teams
            if team.status == FantasyTeamStatus.ACTIVE
        ]

    def _sport_type(self) -> str:
        from app.league.sportConfigs import derive_sport_type

        sport_names = [ls.sport.name for ls in self.sports if ls.sport]
        return derive_sport_type(sport_names)

    @property
    def position_minimums(self) -> dict[str, int]:
        """Canonical position-minimum quotas for this league's squad shape —
        single source of truth for the frontend (create-team/draft/transfers)
        instead of hardcoding numbers that could drift from the backend."""
        from app.league.sportConfigs import get_position_minimums

        sport_type = self._sport_type()
        mode = "mixed" if sport_type == "mixed" else "single"
        return get_position_minimums(sport_type, mode)

    @property
    def max_per_club(self) -> int:
        """Max players allowed from the same real-world club — see
        position_minimums for why this is exposed the same way."""
        from app.league.sportConfigs import get_max_per_club

        return get_max_per_club(self._sport_type())

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

    # Which season of `sport_id` THIS league uses — the explicit, deliberate
    # mapping cross-sport scoring reads (see get_league_sport_season in
    # app/services/scoring/window_locator.py). Null only transiently; a
    # persisted row should always have this set by create_league/add_sport,
    # which resolve it (or hard-block) rather than leaving it unmapped.
    # No ondelete: retiring a season out from under a league that still
    # references it should fail loudly (FK violation), not silently orphan
    # the mapping.
    season_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("seasons.id"), nullable=True,
    )

    # Competition scope for THIS sport's player pool ("EPL" | "LALIGA" |
    # "BUNDESLIGA" — RealTeam.competition values, see
    # app/services/sync/football_competitions.py). NULL = all competitions.
    # Enforced by app/league/competition_scope.py at every pool/roster
    # entry point.
    competition_filter: Mapped[str | None] = mapped_column(String(20), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    league: Mapped["League"] = relationship(back_populates="sports")
    sport: Mapped["Sport"] = relationship()
    season: Mapped["Season | None"] = relationship()


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

    status: Mapped[LeagueMembershipStatus] = mapped_column(
        SAEnum(
            LeagueMembershipStatus,
            name="league_membership_status_enum",
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
            native_enum=False,
        ),
        nullable=False,
        default=LeagueMembershipStatus.ACTIVE,
        server_default=text("'active'"),
        index=True,
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

    # Snapshot of the league settings that created this team.
    # Used to decide whether an archived team can be safely restored later.
    starting_budget: Mapped[Decimal] = mapped_column(
        Numeric(precision=12, scale=2), nullable=False
    )
    starting_squad_size: Mapped[int] = mapped_column(SmallInteger, nullable=False)

    status: Mapped[FantasyTeamStatus] = mapped_column(
        SAEnum(
            FantasyTeamStatus,
            name="fantasy_team_status_enum",
            values_callable=lambda enum_cls: [e.value for e in enum_cls],
            native_enum=False,
        ),
        nullable=False,
        default=FantasyTeamStatus.ACTIVE,
        server_default=text("'active'"),
        index=True,
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

    # current_budget may go negative for a dynasty-renewed team whose carried
    # roster costs more than the new season's budget_per_team (player prices
    # drifted between seasons). Acquisition paths (transfer, transfer_service)
    # already compute their budget checks against the live current_budget, so
    # a negative team is frozen out of new acquisitions until it drops enough
    # to return to >= 0 — dropping is never blocked. See renew_league(dynasty=True).
    __table_args__ = (
        UniqueConstraint("league_id", "user_id", name="uq_team_league_user"),
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
    # Denormalised league_id (reachable via fantasy_team, but stored here so the
    # free-agent pool query and the draft-ownership index avoid a join).
    league_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leagues.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    # Snapshot of league.draft_mode. Lets the unique-ownership index below be
    # scoped to draft leagues (a partial-index predicate can only reference this
    # table's own columns). draft_mode never changes after league creation, so
    # the snapshot cannot drift — same rationale as sport_type below.
    is_draft: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False,
    )
    # FK to players table
    player_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("players.id"),
        nullable=False, index=True,
    )

    # Snapshot of the player's sport at acquisition time.
    # This avoids repeated Player -> Sport joins when filtering or auditing rosters.
    sport_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)

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
        # League-wide unique ownership for DRAFT leagues only: a player may be
        # actively owned by at most one team per draft league. Budget/classic
        # leagues (is_draft=false) are intentionally excluded — the same player
        # can sit on many teams there.
        Index(
            "uq_draft_active_player_ownership",
            "league_id", "player_id",
            unique=True,
            postgresql_where=text("released_window_id IS NULL AND is_draft = true"),
            # SQLite (tests) also supports partial indexes; keep the predicate so
            # release-then-re-add of the same player (trades) doesn't collide.
            sqlite_where=text("released_window_id IS NULL AND is_draft = 1"),
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

    # Set by an admin compensating-entry reversal (app/admin/services.py::admin_reverse_transfer).
    # Never cleared once set — the original row stays untouched either way,
    # this just flags it as superseded so it can't be reversed twice.
    reversed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
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
# 9b. PointsPenalty — budget-mode "pay a budget overage with league points"
# ═══════════════════════════════════════════════════════════════════════════════
#
# When a budget-mode transfer would take a team's current_budget negative,
# the owner can opt to cover the shortfall with league points instead of
# being blocked (settings.BUDGET_OVERAGE_POINTS_RATE converts budget units to
# points). One row per transfer/staged-in event that triggers a charge.
# Netted out of standings/rank at read time in get_league_leaderboard() and
# app/services/scoring/ranking.py — never mutates the raw computed
# TeamWeeklyScore.points, which the scoring engine freely overwrites.


class PointsPenalty(Base):
    __tablename__ = "points_penalties"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    league_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leagues.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    fantasy_team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fantasy_teams.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    # The window the transfer was made in — this is where the penalty is
    # netted out of standings/rank (see ranking.py).
    transfer_window_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("transfer_windows.id"),
        nullable=False, index=True,
    )
    # Nullable: staged-session penalties are written at confirm time, after
    # the Transfer row(s) already exist, but a single confirm can pair
    # multiple pending in/out moves into fewer Transfer rows than penalty
    # events — so this is best-effort traceability, not a hard link.
    transfer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("transfers.id", ondelete="SET NULL"), nullable=True,
    )

    points_charged: Mapped[Decimal] = mapped_column(
        Numeric(precision=8, scale=2), nullable=False
    )
    # 'budget_overage' for now — kept as a free string so future penalty
    # reasons (if any) don't need a migration.
    reason: Mapped[str] = mapped_column(String(30), nullable=False, default="budget_overage")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    fantasy_team: Mapped["FantasyTeam"] = relationship(foreign_keys=[fantasy_team_id])
    transfer_window: Mapped["TransferWindow"] = relationship(foreign_keys=[transfer_window_id])
    transfer: Mapped["Transfer | None"] = relationship(foreign_keys=[transfer_id])

    __table_args__ = (
        CheckConstraint("points_charged > 0", name="ck_points_penalty_positive"),
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

    # Whether this player is in the starting lineup (True) or on the bench
    # (False). Only starters score directly; bench players are auto-substituted
    # in for starters who play 0 minutes (formation permitting) at scoring time.
    is_starter: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )
    # Auto-substitution priority for bench players (0 = first to come on).
    # NULL for starters.
    bench_order: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)

    # True when this row was written by the auto-carry-forward job (user
    # never submitted a lineup for this window, so last window's was reused
    # after being patched for squad changes) rather than a manual save via
    # update_lineup(). See app/services/lineup_carry_forward_service.py.
    is_carried_forward: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )

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
# 11b. LeagueMatchup
# ═══════════════════════════════════════════════════════════════════════════════
#
# One row per head-to-head pairing per transfer window, for leagues with
# is_head_to_head=True. away_team_id NULL = a bye (odd team count that
# window). result is NULL until the window's scoring finalizes and
# resolve_matchups_for_window() (app/services/matchup_service.py) fills it
# in from TeamWeeklyScore — bye rows get result="bye" immediately at
# generation time instead. See docs/HEAD_TO_HEAD_MATCHUPS.md.
#
# No DB-level uniqueness on "a team appears once per window" — enforced in
# generate_matchups_for_league() at generation time, matching this
# codebase's existing app-layer-enforcement style elsewhere (e.g. the
# dynasty negative-budget freeze).
class LeagueMatchup(Base):
    __tablename__ = "league_matchups"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    league_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("leagues.id", ondelete="CASCADE"), nullable=False,
    )
    transfer_window_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("transfer_windows.id"), nullable=False,
    )
    home_team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fantasy_teams.id", ondelete="CASCADE"), nullable=False,
    )
    # NULL = bye week for home_team_id.
    away_team_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fantasy_teams.id", ondelete="CASCADE"), nullable=True,
    )

    home_points: Mapped[Decimal | None] = mapped_column(Numeric(precision=8, scale=2), nullable=True)
    away_points: Mapped[Decimal | None] = mapped_column(Numeric(precision=8, scale=2), nullable=True)

    # home_win | away_win | tie | bye | NULL (pending — scoring not finalized yet)
    result: Mapped[str | None] = mapped_column(String(20), nullable=True)

    league: Mapped["League"] = relationship(foreign_keys=[league_id])
    transfer_window: Mapped["TransferWindow"] = relationship(foreign_keys=[transfer_window_id])
    home_team: Mapped["FantasyTeam"] = relationship(foreign_keys=[home_team_id])
    away_team: Mapped["FantasyTeam | None"] = relationship(foreign_keys=[away_team_id])

    @property
    def window_number(self) -> int:
        """Gameweek number — for display (Full Schedule view) without a
        separate window lookup on the frontend."""
        return self.transfer_window.number

    __table_args__ = (
        Index("ix_matchup_league_window", "league_id", "transfer_window_id"),
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


# ═══════════════════════════════════════════════════════════════════════════════
# 15. RosterMove
# ═══════════════════════════════════════════════════════════════════════════════
#
# Immutable audit log of every roster change in a DRAFT league: the initial
# draft picks, free-agent add/drops, waiver claims, and trades. Budget-league
# transfers keep using the Transfer table; this is the draft equivalent.
#
# add_player_id / drop_player_id are both nullable so the row can capture an
# add-only, drop-only, or paired add+drop move.


class RosterMove(Base):
    __tablename__ = "roster_moves"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    league_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leagues.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    fantasy_team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fantasy_teams.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    # draft | free_agent | waiver | trade | dynasty_carryover
    move_type: Mapped[str] = mapped_column(String(20), nullable=False)

    add_player_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("players.id"), nullable=True,
    )
    drop_player_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("players.id"), nullable=True,
    )
    # The window the move takes effect in (nullable for pre-season draft picks).
    window_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("transfer_windows.id"), nullable=True,
    )
    # Who initiated the move (nullable for system-run waiver processing).
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True,
    )

    __table_args__ = (
        CheckConstraint(
            "move_type IN ('draft', 'free_agent', 'waiver', 'trade', 'dynasty_carryover')",
            name="ck_roster_move_type",
        ),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 16. WaiverOrder  (draft leagues — rolling priority list, FPL default)
# ═══════════════════════════════════════════════════════════════════════════════
#
# One row per team per draft league. `position` is the rolling waiver priority
# (1 = first pick on contested claims). Initialised to the REVERSE of the draft
# order when the draft completes; after a successful waiver claim the winning
# team moves to the back (highest position).


class WaiverOrder(Base):
    __tablename__ = "waiver_order"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    league_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leagues.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    fantasy_team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fantasy_teams.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    position: Mapped[int] = mapped_column(SmallInteger, nullable=False)

    __table_args__ = (
        UniqueConstraint("league_id", "fantasy_team_id", name="uq_waiver_order_team"),
        UniqueConstraint("league_id", "position", name="uq_waiver_order_position"),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 17. WaiverClaim
# ═══════════════════════════════════════════════════════════════════════════════
#
# A pending add/drop request resolved in bulk at the window's waiver deadline,
# in waiver_order. `claim_priority` orders a single team's own competing claims
# (lower = processed first). `priority_snapshot` records the team's waiver
# position at submission time (informational).


class WaiverClaim(Base):
    __tablename__ = "waiver_claims"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    league_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leagues.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    fantasy_team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fantasy_teams.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    add_player_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("players.id"), nullable=False,
    )
    drop_player_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("players.id"), nullable=False,
    )
    process_window_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("transfer_windows.id"), nullable=False,
    )
    # Order among a single team's own claims (lower runs first).
    claim_priority: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    priority_snapshot: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    # pending | success | failed | cancelled
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    failure_reason: Mapped[str | None] = mapped_column(String(200), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'success', 'failed', 'cancelled')",
            name="ck_waiver_claim_status",
        ),
    )


# ═══════════════════════════════════════════════════════════════════════════════
# 18. TradeOffer  (manager-to-manager swaps, optional veto)
# ═══════════════════════════════════════════════════════════════════════════════
#
# offered_player_ids / requested_player_ids are JSON arrays of player UUID
# strings (portable across Postgres + the SQLite test shim). On accept the trade
# enters a veto window; it finalises (atomic ownership swap) once veto_deadline
# passes unless vetoed.


class TradeOffer(Base):
    __tablename__ = "trade_offers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    league_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leagues.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    from_team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fantasy_teams.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    to_team_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("fantasy_teams.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    offered_player_ids: Mapped[list] = mapped_column(JSON, nullable=False)
    requested_player_ids: Mapped[list] = mapped_column(JSON, nullable=False)
    # proposed | accepted | rejected | cancelled | vetoed | executed
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="proposed")
    veto_deadline: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('proposed', 'accepted', 'rejected', 'cancelled', "
            "'vetoed', 'executed')",
            name="ck_trade_offer_status",
        ),
    )

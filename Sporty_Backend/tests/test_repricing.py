"""Tests for the merged performance+demand repricing algorithm
(app/services/pricing/repricing.py). SQLite throwaway DB, same pattern as
test_draft_waivers_trades.py."""
from __future__ import annotations

import os
import sys
import tempfile
import uuid
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

_temp_dir = tempfile.mkdtemp(prefix="sporty-repricing-tests-")
os.environ["DATABASE_URL"] = f"sqlite+pysqlite:///{Path(_temp_dir) / 'rp.db'}"
os.environ["JWT_SECRET_KEY"] = "x" * 32
os.environ["GOOGLE_CLIENT_ID"] = "test-client"

_backend_root = Path(__file__).resolve().parents[1]
os.chdir(_temp_dir)
if str(_backend_root) not in sys.path:
    sys.path.insert(0, str(_backend_root))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base  # noqa: E402
from app.auth.models import AuthProvider, User  # noqa: E402
import app.match.models  # noqa: F401,E402
import app.player.models  # noqa: F401,E402
import app.player.models_nba  # noqa: F401,E402
from app.league import services as league_service  # noqa: E402
from app.league.models import (  # noqa: E402
    FantasyTeam,
    League,
    Season,
    Sport,
    Transfer,
    TransferWindow,
)
from app.league.schemas import LeagueCreate  # noqa: E402
from app.player.models import Player, PlayerGameweekStat, PlayerPriceHistory, RealTeam  # noqa: E402
from app.services.pricing.repricing import SPORT_POLICIES, recalculate_player_prices  # noqa: E402

import pytest  # noqa: E402
from fastapi import HTTPException  # noqa: E402
import app.admin.models  # noqa: F401,E402
from app.admin import services as admin_services  # noqa: E402

ENGINE = create_engine(os.environ["DATABASE_URL"])
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=ENGINE)


@contextmanager
def session_scope():
    Base.metadata.drop_all(bind=ENGINE)
    Base.metadata.create_all(bind=ENGINE)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _sport(db, name: str) -> Sport:
    s = Sport(name=name, display_name=name.title())
    db.add(s); db.flush(); return s


def _season(db, sport: Sport, start_date: date = date(2026, 1, 1),
            end_date: date = date(2026, 12, 31)) -> Season:
    s = Season(sport_id=sport.id, name=f"S-{uuid.uuid4().hex[:6]}",
               start_date=start_date, end_date=end_date)
    db.add(s); db.flush(); return s


def _window(db, season: Season, end_at: datetime, number: int = 1) -> TransferWindow:
    start_at = end_at - timedelta(days=6)
    w = TransferWindow(
        season_id=season.id, number=number,
        start_at=start_at, end_at=end_at,
        transfer_deadline_at=start_at,
        lineup_deadline_at=start_at + timedelta(days=1),
    )
    db.add(w); db.flush(); return w


def _real_team(db, sport: Sport) -> RealTeam:
    rt = RealTeam(sport_id=sport.id, name=f"RT-{uuid.uuid4().hex[:6]}",
                  external_api_id=f"t:{uuid.uuid4().hex[:8]}")
    db.add(rt); db.flush(); return rt


def _player(db, sport: Sport, rt: RealTeam, cost: Decimal, name="P") -> Player:
    p = Player(sport_id=sport.id, external_api_id=f"p:{uuid.uuid4().hex[:10]}",
               name=f"{name}-{uuid.uuid4().hex[:6]}", position="MID",
               real_team=rt.name, real_team_id=rt.id, cost=cost, is_available=True)
    db.add(p); db.flush(); return p


def _stat(db, player: Player, window: TransferWindow, fantasy_points: Decimal) -> None:
    db.add(PlayerGameweekStat(player_id=player.id, transfer_window_id=window.id,
                               fantasy_points=fantasy_points))
    db.flush()


def _user(db, name: str) -> User:
    u = User(username=name, email=f"{name}@e.com",
              auth_provider=AuthProvider.LOCAL, password_hash="h")
    db.add(u); db.flush(); return u


def _league_and_team(db, season: Season, sport_name: str) -> tuple[League, FantasyTeam]:
    owner = _user(db, f"owner-{uuid.uuid4().hex[:6]}")
    league = league_service.create_league(
        db, LeagueCreate(name=f"L-{uuid.uuid4().hex[:6]}", season_id=season.id,
                          sports=[sport_name]), owner,
    )
    team = FantasyTeam(league_id=league.id, user_id=owner.id, name="T",
                        current_budget=league.budget_per_team,
                        starting_budget=league.budget_per_team,
                        starting_squad_size=league.squad_size)
    db.add(team); db.flush()
    return league, team


def _transfer_in(db, team: FantasyTeam, window: TransferWindow, player_in: Player, player_out: Player) -> None:
    db.add(Transfer(fantasy_team_id=team.id, transfer_window_id=window.id,
                     player_out_id=player_out.id, player_in_id=player_in.id,
                     cost_at_transfer=player_in.cost))
    db.flush()


def test_performance_only_delta_is_weighted_and_clamped() -> None:
    with session_scope() as db:
        sport = _sport(db, "football")
        season = _season(db, sport)
        window = _window(db, season, datetime(2026, 2, 1, tzinfo=timezone.utc))
        rt = _real_team(db, sport)
        player = _player(db, sport, rt, cost=Decimal("10.00"))
        _stat(db, player, window, Decimal("10"))  # baseline=6, factor=0.15 -> perf_delta=0.6

        recalculate_player_prices(db, lookback_windows=1)

        db.refresh(player)
        # perf_delta(0.6) * performance_weight(0.70) = 0.42, no demand signal
        assert player.cost == Decimal("10.42")
        history = db.query(PlayerPriceHistory).filter(PlayerPriceHistory.player_id == player.id).one()
        assert history.algorithm_version == "v2"


def test_demand_only_delta_moves_price_with_flat_performance() -> None:
    with session_scope() as db:
        sport = _sport(db, "football")
        season = _season(db, sport)
        window = _window(db, season, datetime(2026, 2, 1, tzinfo=timezone.utc))
        rt = _real_team(db, sport)
        player = _player(db, sport, rt, cost=Decimal("10.00"))
        other = _player(db, sport, rt, cost=Decimal("5.00"), name="Out")
        _stat(db, player, window, Decimal("6"))  # == baseline -> perf_delta = 0

        league, team = _league_and_team(db, season, "football")
        for _ in range(3):
            _transfer_in(db, team, window, player_in=player, player_out=other)

        recalculate_player_prices(db, lookback_windows=1)

        db.refresh(player)
        # demand_score=1.0 -> demand_delta=1.50 * demand_weight(0.30) = 0.45
        assert player.cost == Decimal("10.45")


def test_blended_delta_still_respects_max_cost_ceiling() -> None:
    with session_scope() as db:
        sport = _sport(db, "football")
        season = _season(db, sport)
        window = _window(db, season, datetime(2026, 2, 1, tzinfo=timezone.utc))
        rt = _real_team(db, sport)
        player = _player(db, sport, rt, cost=Decimal("19.00"))
        other = _player(db, sport, rt, cost=Decimal("5.00"), name="Out")
        _stat(db, player, window, Decimal("50"))  # huge overperformance

        league, team = _league_and_team(db, season, "football")
        _transfer_in(db, team, window, player_in=player, player_out=other)

        recalculate_player_prices(db, lookback_windows=1)

        db.refresh(player)
        policy = SPORT_POLICIES["football"]
        # Both signals maxed would push well past max_cost — the per-sport
        # ceiling must still be honored (this is exactly the bug the old
        # demand-only algorithm had: it had no ceiling at all).
        assert player.cost == policy.max_cost


def test_rerunning_against_unchanged_stats_does_not_reapply_delta() -> None:
    """Regression guard: a daily cron re-running against a window whose stats
    haven't moved must not keep marching price toward max_cost (the bug that
    pinned ~27% of the football pool at the 20M ceiling after ~12 daily runs
    with no new match data)."""
    with session_scope() as db:
        sport = _sport(db, "football")
        season = _season(db, sport)
        window = _window(db, season, datetime(2026, 2, 1, tzinfo=timezone.utc))
        rt = _real_team(db, sport)
        player = _player(db, sport, rt, cost=Decimal("10.00"))
        _stat(db, player, window, Decimal("10"))  # baseline=6, factor=0.15 -> perf_delta=0.6

        recalculate_player_prices(db, lookback_windows=1)
        db.refresh(player)
        assert player.cost == Decimal("10.42")

        # Same window, same stats, no new transfers — rerun the job as the
        # daily cron would the next day with nothing having changed.
        result = recalculate_player_prices(db, lookback_windows=1)
        db.refresh(player)
        assert player.cost == Decimal("10.42")
        assert result["updated"] == 0
        assert result["unchanged"] == 1

        history_rows = (
            db.query(PlayerPriceHistory)
            .filter(PlayerPriceHistory.player_id == player.id)
            .all()
        )
        assert len(history_rows) == 1  # no duplicate row from the no-op rerun

        # New stats arrive for the same window (more matches finished) —
        # price should move again.
        _stat_row = (
            db.query(PlayerGameweekStat)
            .filter(PlayerGameweekStat.player_id == player.id)
            .one()
        )
        _stat_row.fantasy_points = Decimal("14")
        db.commit()

        recalculate_player_prices(db, lookback_windows=1)
        db.refresh(player)
        assert player.cost > Decimal("10.42")


def test_rerunning_with_new_demand_signal_still_moves_price() -> None:
    """Regression guard for the gap in the first no-op fix: that guard only
    compared weighted_points, so a demand-only change (new transfers, stats
    unchanged) after a performance-only price move was silently swallowed
    too. The guard must compare both signals -- a change in either one
    should still reprice; only a fully-unchanged run is a no-op."""
    with session_scope() as db:
        sport = _sport(db, "football")
        season = _season(db, sport)
        window = _window(db, season, datetime(2026, 2, 1, tzinfo=timezone.utc))
        rt = _real_team(db, sport)
        player = _player(db, sport, rt, cost=Decimal("10.00"))
        other = _player(db, sport, rt, cost=Decimal("5.00"), name="Out")
        _stat(db, player, window, Decimal("10"))  # baseline=6, factor=0.15 -> perf_delta=0.6

        # First run: performance-only move, no transfers yet (demand_score=0).
        recalculate_player_prices(db, lookback_windows=1)
        db.refresh(player)
        assert player.cost == Decimal("10.42")

        # Rerun with nothing changed at all -- still a true no-op.
        result = recalculate_player_prices(db, lookback_windows=1)
        db.refresh(player)
        assert player.cost == Decimal("10.42")
        assert result["updated"] == 0

        # Now demand changes (new transfers land) while stats stay flat --
        # before the demand_score fix, this would have been skipped too
        # because only weighted_points was compared.
        league, team = _league_and_team(db, season, "football")
        for _ in range(3):
            _transfer_in(db, team, window, player_in=player, player_out=other)

        result = recalculate_player_prices(db, lookback_windows=1)
        db.refresh(player)
        assert result["updated"] == 1
        assert player.cost > Decimal("10.42")


def test_rerunning_at_the_cap_produces_no_duplicate_history_rows() -> None:
    """A player already pinned at max_cost with a continuing strong signal
    must not accumulate duplicate PlayerPriceHistory rows on repeated
    reruns -- confirms the no-op guard and the pre-existing
    next_cost == player.cost check compose correctly at the ceiling."""
    with session_scope() as db:
        sport = _sport(db, "football")
        season = _season(db, sport)
        window = _window(db, season, datetime(2026, 2, 1, tzinfo=timezone.utc))
        rt = _real_team(db, sport)
        player = _player(db, sport, rt, cost=Decimal("19.00"))
        other = _player(db, sport, rt, cost=Decimal("5.00"), name="Out")
        _stat(db, player, window, Decimal("50"))  # huge overperformance

        league, team = _league_and_team(db, season, "football")
        _transfer_in(db, team, window, player_in=player, player_out=other)

        policy = SPORT_POLICIES["football"]

        recalculate_player_prices(db, lookback_windows=1)
        db.refresh(player)
        assert player.cost == policy.max_cost

        for _ in range(3):
            recalculate_player_prices(db, lookback_windows=1)
            db.refresh(player)
            assert player.cost == policy.max_cost

        history_rows = (
            db.query(PlayerPriceHistory)
            .filter(PlayerPriceHistory.player_id == player.id)
            .all()
        )
        assert len(history_rows) == 1


def test_trigger_repricing_rejects_when_lock_held(monkeypatch: pytest.MonkeyPatch) -> None:
    """Admin manual repricing (app/admin/services.py:trigger_repricing) used
    to call recalculate_player_prices directly with no lock at all, unlike
    the Celery-scheduled path -- an admin trigger overlapping the daily cron
    (or two admins clicking at once) had nothing preventing a concurrent
    run. It must now share the same lock key and back off with a 409 rather
    than run unlocked."""

    @contextmanager
    def _lock_held(*args, **kwargs):
        yield False

    monkeypatch.setattr(admin_services, "redis_lock", _lock_held)

    with pytest.raises(HTTPException) as exc_info:
        admin_services.trigger_repricing(db=None, actor=None, lookback_windows=3)

    assert exc_info.value.status_code == 409


def test_basketball_post_fix_scale_gives_sane_delta() -> None:
    """Regression guard for the season-totals-vs-per-game ingestion bug:
    a realistic post-fix per-game fantasy_points value should move price by
    a small, sane amount — not slam into the step cap every run."""
    with session_scope() as db:
        sport = _sport(db, "basketball")
        season = _season(db, sport)
        window = _window(db, season, datetime(2026, 2, 1, tzinfo=timezone.utc))
        rt = _real_team(db, sport)
        player = _player(db, sport, rt, cost=Decimal("13.46"))
        _stat(db, player, window, Decimal("12.00"))  # realistic per-game value, not season total

        recalculate_player_prices(db, lookback_windows=1)

        db.refresh(player)
        policy = SPORT_POLICIES["basketball"]
        delta = abs(player.cost - Decimal("13.46"))
        assert delta < policy.max_step_per_run
        assert player.cost == Decimal("13.80")


def test_inactive_season_windows_are_ignored() -> None:
    """Regression for the 2026-07 ceiling pile-up.

    The CSV importer mints synthetic `dataset-import-*` seasons dated 2098/2099
    holding season aggregates in a single gameweek row. Window selection used to
    be a bare `ORDER BY end_at DESC LIMIT n`, so those windows won every run and
    real gameweeks were never priced. Only active-season windows may count."""
    with session_scope() as db:
        sport = _sport(db, "football")

        live_season = _season(db, sport)
        live_window = _window(db, live_season, datetime(2026, 2, 1, tzinfo=timezone.utc))

        junk_season = _season(db, sport, start_date=date(2099, 8, 1),
                              end_date=date(2100, 5, 31))
        junk_season.name = "dataset-import-2025-26"
        junk_season.is_active = False
        db.flush()
        # Dated far in the future, exactly like the real rows.
        junk_window = _window(db, junk_season, datetime(2099, 8, 2, tzinfo=timezone.utc))

        rt = _real_team(db, sport)
        player = _player(db, sport, rt, cost=Decimal("8.00"))
        _stat(db, player, live_window, Decimal("6.00"))       # exactly baseline -> no move
        _stat(db, player, junk_window, Decimal("144.00"))     # season aggregate

        recalculate_player_prices(db, lookback_windows=3)

        db.refresh(player)
        # Had the junk window been included it would dominate the weighting and
        # slam the player into the +1.50 step cap.
        assert player.cost == Decimal("8.00")


def test_implausible_gameweek_rows_are_skipped() -> None:
    """A season aggregate sitting inside a legitimate window is not priced in."""
    with session_scope() as db:
        sport = _sport(db, "football")
        season = _season(db, sport)
        window = _window(db, season, datetime(2026, 2, 1, tzinfo=timezone.utc))
        rt = _real_team(db, sport)
        player = _player(db, sport, rt, cost=Decimal("8.00"))
        _stat(db, player, window, Decimal("144.00"))

        result = recalculate_player_prices(db, lookback_windows=1)

        db.refresh(player)
        assert player.cost == Decimal("8.00")
        assert result["evaluated"] == 0


def test_anchor_bounds_total_drift_so_price_cannot_ratchet_to_ceiling() -> None:
    """The core regression: a sustained above-baseline signal must converge.

    Before the anchor bound, each run added up to max_step_per_run against the
    same unchanged form, so a player walked from 8.95 to the 17.0 ceiling in
    days — this is precisely what happened to Alex Iwobi (+1.50/day for six
    consecutive days). Drift from anchor_cost is now bounded."""
    from app.services.pricing.repricing import MAX_DRIFT_FROM_ANCHOR

    with session_scope() as db:
        sport = _sport(db, "football")
        season = _season(db, sport)
        rt = _real_team(db, sport)
        player = _player(db, sport, rt, cost=Decimal("8.00"))
        player.anchor_cost = Decimal("8.00")
        db.flush()

        policy = SPORT_POLICIES["football"]

        # Twenty daily runs, each with a fresh window carrying a strong but
        # entirely plausible per-gameweek score. Distinct windows keep the
        # unchanged-signal guard from masking the ratchet we're testing.
        for day in range(20):
            window = _window(db, season, datetime(2026, 3, 1, tzinfo=timezone.utc)
                             + timedelta(days=day), number=day + 1)
            _stat(db, player, window, Decimal("20.00"))
            recalculate_player_prices(db, lookback_windows=1)

        db.refresh(player)
        assert player.cost <= Decimal("8.00") + MAX_DRIFT_FROM_ANCHOR
        assert player.cost < policy.max_cost


def test_anchor_absent_falls_back_to_policy_bounds() -> None:
    """Players never seeded keep the old behaviour — the column is additive."""
    with session_scope() as db:
        sport = _sport(db, "football")
        season = _season(db, sport)
        window = _window(db, season, datetime(2026, 2, 1, tzinfo=timezone.utc))
        rt = _real_team(db, sport)
        player = _player(db, sport, rt, cost=Decimal("8.00"))
        assert player.anchor_cost is None
        _stat(db, player, window, Decimal("20.00"))

        recalculate_player_prices(db, lookback_windows=1)

        db.refresh(player)
        assert player.cost > Decimal("8.00")

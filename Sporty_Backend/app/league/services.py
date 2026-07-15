"""Facade over the split league service modules.

The original 3,972-line module was split by domain (2026-07, Phase 4):
  service_helpers   — shared guards / window locators / query options
  league_service    — league CRUD, membership, seasons/renewal, settings
  draft_service     — live draft room
  transfers_service — league transfers + points-penalty
  lineup_service    — weekly lineups + user team view
  standings_service — leaderboard + gameweek recap

Every public AND private name is re-exported here so existing imports
(`from app.league import services`, `from app.league.services import X`)
keep working. New code should import from the specific module.
"""

from app.league.service_helpers import (  # noqa: F401
    _current_transfer_window,
    _editable_transfer_window,
    _find_editable_transfer_window,
    _find_transfer_window,
    _generate_invite_code,
    _league_sport_mode,
    _require_fantasy_team,
    _require_league,
    _require_membership,
    _serialize_window,
    SUPPORTED_LEAGUE_SPORTS,
    VALID_TRANSITIONS,
    _DRAFT_PICK_OPTIONS,
    _LEAGUE_OPTIONS,
    _MEMBERSHIP_OPTIONS,
    _TRANSFER_OPTIONS,
)
from app.league.league_service import (  # noqa: F401
    _attach_dynasty_history_info,
    _attach_midseason_join_info,
    _attach_my_team_summaries,
    _carry_over_dynasty_rosters,
    _deactivate_membership,
    _next_available_season,
    add_lineup_slot,
    add_sport,
    build_initial_team,
    create_league,
    delete_league,
    discover_public_leagues,
    get_active_seasons,
    get_active_sports,
    get_active_transfer_window,
    get_dashboard_stats,
    get_editable_transfer_window,
    get_league,
    get_leagues_for_user,
    get_members,
    get_season_history,
    join_league,
    leave_league,
    remove_member,
    remove_sport,
    renew_league,
    update_league_settings,
    update_league_status,
    update_midseason_join_setting,
)
from app.league.draft_service import (  # noqa: F401
    _advance_draft_clock,
    _execute_draft_pick,
    _publish_draft_event,
    _require_draftable_player,
    get_current_draft_turn,
    make_draft_pick,
    select_auto_pick_player,
    start_draft,
)
from app.league.transfers_service import (  # noqa: F401
    discard_team_player,
    get_available_points_for_penalty,
    get_transfers,
    get_user_transfers_grouped_by_league,
    make_transfer,
)
from app.league.lineup_service import (  # noqa: F401
    _attach_player_points,
    _build_lineup_payload,
    get_current_lineup,
    get_live_lineup,
    get_user_team,
    update_lineup,
)
from app.league.standings_service import (  # noqa: F401
    get_gameweek_recap,
    get_league_leaderboard,
)

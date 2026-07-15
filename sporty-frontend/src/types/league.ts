import { TUser } from "./index";
import { TPlayerBrief } from "./player";

export type TLeagueStatus = "setup" | "drafting" | "active" | "completed";
export type TCompetitionType = "draft" | "budget";

export type TSportBrief = {
  id?: string;
  name: string;
  display_name: string;
};

export type TSeasonBrief = {
  id?: string;
  name: string;
  start_date: string;
  end_date: string;
};

export type TSeason = TSeasonBrief & {
  sport_id: string;
  /** Resolved sport display name from the backend — prefer this over
   * resolving sport_id client-side (the /leagues/sports lookup only lists
   * league-playable sports, so e.g. Cricket resolved to a raw UUID). */
  sport_name?: string | null;
  is_active: boolean;
  /** Date-derived: today falls within [start_date, end_date]. At most one
   * season per sport can be current at a time (DB-enforced, no overlaps). */
  is_current: boolean;
  /** Weekday transfer windows are generated on (1=Monday..7=Sunday), null
   * until an admin generates windows for this season. */
  transfer_day: number | null;
  /** Season.total_windows — 0 means no league on this season can go ACTIVE
   * yet (see admin Seasons "Generate Windows" action). */
  total_windows: number;
};

export type TSport = TSportBrief & {
  is_active: boolean;
};

export type TLeagueSport = {
  sport: TSportBrief;
  created_at: string;
};

export type TLeague = {
  id: string;
  name: string;
  owner: TUser;
  competition_type?: TCompetitionType;
  draft_mode?: boolean;
  draft_pick_seconds?: number;
  is_head_to_head?: boolean;
  allow_midseason_join?: boolean;
  /** Was this league itself created via a dynasty rollover? Used to default
   * the Dynasty checkbox on the next renewal to the commissioner's last choice. */
  was_dynasty?: boolean;
  budget_per_team?: number;
  is_public?: boolean;
  sports: TLeagueSport[];
  member_count: number;
  invite_code?: string;
  joinable_now?: boolean;
  midseason_entry_window_number?: number | null;
  midseason_join_message?: string | null;
  status: string;
  season_number?: number;
  squad_size: number;
  // Canonical squad-shape rules (backend app/league/sportConfigs.py) — read
  // these instead of hardcoding position/club numbers on the frontend.
  position_minimums?: Record<string, number>;
  max_per_club?: number;
  team_count?: number;
  memberships?: TMembership[];
  teams?: TFantasyTeam[];
  season?: TSeasonBrief;
  lineup_slots?: TLineupSlot[];
  teams_detail?: {
    team_name: string;
    team_owner: TUser;
    joined_at: string;
  }[];
  my_team?: {
    id: string;
    name: string;
    rank: number | null;
    points: number | null;
  };
};

/** One entry in a league's season-rollover lineage (GET /leagues/{id}/seasons). */
export type TSeasonHistoryItem = {
  id: string;
  season_number: number;
  status: TLeagueStatus;
  name: string;
  start_date: string | null;
  end_date: string | null;
};

export type TLineupEntry = {
  player_id: string;
  is_captain: boolean;
  is_vice_captain: boolean;
  created_at: string;
  player: {
    id: string;
    name: string;
    position: string;
    real_team: string;
    photo_url?: string | null;
    real_team_logo_url?: string | null;
    cost: string;
    sport: {
      name: string;
      display_name: string;
    };
  };
};

export type TLineupResponse = {
  fantasy_team_id: string;
  team_name: string;
  transfer_window_id: string;
  starting_lineup: TLineupEntry[];
  squad_players: TTeamPlayer[];
};

export type TLineupUpdateRequest = {
  starting_lineup_player_ids: string[];
  bench_player_ids?: string[];
  captain_id: string;
  vice_captain_id: string;
};

export type TGameweekPlayerStatus =
  | "played"
  | "did_not_play"
  | "not_yet_played"
  | "subbed_in"
  | "subbed_out"
  | "benched";

export type TGameweekPlayerRecap = {
  player: {
    id: string;
    name: string;
    position: string;
    real_team: string;
    photo_url?: string | null;
    real_team_logo_url?: string | null;
    cost: string;
    sport: {
      name: string;
      display_name: string;
    };
  };
  is_starter: boolean;
  is_captain: boolean;
  is_vice_captain: boolean;
  bench_order: number | null;
  minutes_played: number;
  points: string;
  captain_bonus: string;
  counted: boolean;
  status: TGameweekPlayerStatus;
  contributed_points: string;
};

export type TGameweekRecapResponse = {
  fantasy_team_id: string;
  team_name: string;
  transfer_window_id: string;
  gameweek_number: number;
  total_points: string;
  base_points: string;
  captain_vice_bonus: string;
  rank_in_league: number | null;
  players: TGameweekPlayerRecap[];
  // "Beat the Optimizer" — best possible lineup score in hindsight, and
  // what % of it the actual lineup captured. null until the window plays.
  best_possible_points: string | null;
  capture_rate: number | null;
};

export type TPointsPenalty = {
  points_charged: number;
  reason: string;
  created_at: string;
};

export type TLeaderboardEntry = {
  team_id: string;
  team_name: string;
  owner_name: string;
  points: number;
  points_deducted: number;
  penalties: TPointsPenalty[];
  rank: number | null;
};

export type TLeaderboardResponse = {
  league_id: string;
  transfer_window_id: string | null;
  entries: TLeaderboardEntry[];
};

export type TMembership = {
  id: string;
  user: TUser;
  status: "active" | "left";
  draft_position: number | null;
  joined_at: string;
  eligible_from_window_id?: string | null;
};

export type TLineupSlot = {
  id: string;
  sport: TSportBrief;
  position: string;
  min_count: number;
  max_count: number;
};

export type TDraftPick = {
  id: string;
  round_number: number;
  pick_number: number;
  player: TPlayerBrief;
  fantasy_team: {
    id: string;
    name: string;
    owner: TUser;
    created_at: string;
  };
  picked_at: string;
};

export type TDraftTurn = {
  league_id: string;
  current_turn_user_id: string | null;
  next_pick_number: number;
  round_number: number;
  is_draft_complete: boolean;
  total_picks_possible: number;
  pick_deadline_at: string | null;
};

/** Draft-room SSE stream events (GET /api/leagues/{id}/draft/stream),
 * published to the same channel _publish_draft_started already used —
 * see app/league/services.py _advance_draft_clock / _publish_draft_event. */
export type TDraftEvent =
  | { type: "draft_started"; league_id: string; status: string }
  | { type: "draft_status"; league_id: string; status: string | null; pick_deadline_at?: string | null }
  | {
      type: "draft_turn_update";
      league_id: string;
      current_turn_user_id: string | null;
      next_pick_number: number;
      round_number: number;
      pick_deadline_at: string | null;
    }
  | {
      type: "draft_pick_made";
      league_id: string;
      pick_number: number;
      round_number: number;
      player: { id: string; name: string; position: string };
      team: { id: string; name: string };
      was_auto_pick: boolean;
    }
  | { type: "draft_complete"; league_id: string };

export type TDiscardPlayerResponse = {
  message: string;
  refund: number;
  penalty_applied: number;
  remaining_budget: number;
};

export type TTeamPlayer = {
  player: {
    id: string;
    name: string;
    position: string;
    real_team: string;
    photo_url?: string | null;
    real_team_logo_url?: string | null;
    cost: string;
    sport: {
      name: string;
      display_name: string;
    };
  };
  created_at: string;
  joined_at?: string;
  // Per-player points (populated by GET /leagues/{id}/my-team). Decimal strings.
  total_points?: string;
  avg_points?: string;
  gameweek_points?: string;
};

export type TTransferPlayer = {
  id: string;
  name?: string;
  display_name?: string;
  position: string;
  real_team: string;
  photo_url?: string | null;
  real_team_logo_url?: string | null;
  cost: number | string;
  sport: TSportBrief;
};

export type TTransfer = {
  id: string;
  player_out: TTransferPlayer;
  player_in: TTransferPlayer;
  transfer_window: {
    id: string;
    number: number;
    start_at: string;
    end_at: string;
  };
  cost_at_transfer: number | string;
  // Set when this transfer covered a budget-mode overage with league
  // points instead of being blocked. Absent/null otherwise.
  points_charged?: number | string | null;
  created_at: string;
};

/** Structured 409 body for a budget-mode transfer that would go over budget
 * (backend: app/league/services.py::make_transfer /
 * app/services/transfer_service.py::confirm_transfers). `shortfall` is only
 * present on the "insufficient_budget" variant (not "insufficient_points"). */
export type TBudgetOverageDetail = {
  error: "insufficient_budget" | "insufficient_points";
  message: string;
  shortfall?: string;
  points_cost: string;
  available_points: string;
};

export type TUserTransferLeagueGroup = {
  league: {
    id: string;
    name: string;
    sports: TLeagueSport[];
  };
  transfers: TTransfer[];
};

export type TTransferWindow = {
  id: string;
  season_id: string;
  number: number;
  total_number: number;
  start_at: string;
  end_at: string;
  transfer_deadline_at: string;
  lineup_deadline_at: string;
  transfers_locked: boolean;
  lineup_locked: boolean;
};

export type TStageOutRequest = {
  league_id: string;
  gameweek_id: string;
  player_id: string;
};

export type TGameweekPoints = {
  gameweek: number;
  transfer_window_id: string;
  points: number;
  rank: number | null;
};

export type TLeagueDashboardStats = {
  league_id: string;
  team_id: string;
  rank: number | null;
  gameweek_points: number | null;
  total_points: number;
  budget: number;
  gameweek_breakdown: TGameweekPoints[];
};

export type TStageOutResponse = {
  currentBudget: number;
  transfersAllowed: number;
  transfersUsed: number;
};

export type TStageInRequest = {
  league_id: string;
  gameweek_id: string;
  player_id: string;
};

export type TStageInResponse = {
  currentBudget: number;
  transfersRemaining: number;
  // Informational only — what confirming right now would cost in league
  // points if the session stayed over budget (0 when not over budget).
  // Staging never blocks on this; confirm_transfers is the real gate.
  pointsCostIfConfirmed?: number;
};

export type TConfirmTransfersRequest = {
  league_id: string;
  gameweek_id: string;
  // Retry flag: covers a budget shortfall with league points instead of
  // the confirm being blocked. Only meaningful after a first attempt
  // returned a TBudgetOverageDetail with error: "insufficient_budget".
  pay_shortfall_with_points?: boolean;
};

export type TConfirmTransfersResponse = {
  success: boolean;
  newBudget: number;
  transfersRemaining: number;
  // Points charged to cover a budget overage, or null if none was needed.
  pointsCharged?: number | null;
};

export type TFreeAgent = {
  id: string;
  name: string;
  position: string;
  real_team: string;
  photo_url?: string | null;
  real_team_logo_url?: string | null;
  cost: number;
  sport: string;
};

export type TFreeAgentPage = {
  items: TFreeAgent[];
  total: number;
};

export type TFreeAgentClaimResponse = {
  status: string;
  added: { id: string; name: string };
  dropped: { id: string; name: string };
  effective_window_id: string;
};

export type TWaiverClaim = {
  id: string;
  add_player_id: string;
  drop_player_id: string;
  claim_priority: number;
  status: "pending" | "success" | "failed" | "cancelled";
  failure_reason: string | null;
};

export type TWaiverOrderEntry = {
  position: number;
  fantasy_team_id: string;
  team_name: string;
};

export type TMatchupTeamBrief = {
  id: string;
  name: string;
  user: TUser;
};

export type TMatchup = {
  id: string;
  transfer_window_id: string;
  window_number: number;
  home_team: TMatchupTeamBrief;
  away_team: TMatchupTeamBrief | null;
  // Decimal fields serialize as JSON strings in this backend (same as
  // total_points/base_points elsewhere) — coerce with Number() before math.
  home_points: string | null;
  away_points: string | null;
  result: "home_win" | "away_win" | "tie" | "bye" | null;
};

export type TH2HStandingRow = {
  fantasy_team_id: string;
  team_name: string;
  owner_username: string;
  owner_avatar_url: string | null;
  wins: number;
  losses: number;
  ties: number;
  // Decimal fields — see TMatchup note above.
  points_for: string;
  points_against: string;
};

export type TRosterPlayer = {
  id: string;
  name: string;
  position: string;
  real_team: string;
  photo_url?: string | null;
  real_team_logo_url?: string | null;
  sport: string;
};

export type TLeagueRoster = {
  team_id: string;
  team_name: string;
  players: TRosterPlayer[];
};

export type TTradeStatus =
  | "proposed"
  | "accepted"
  | "rejected"
  | "cancelled"
  | "vetoed"
  | "executed";

export type TChatReaction = {
  emoji: string;
  count: number;
  reacted_by_me: boolean;
};

export type TChatMessage = {
  id: string;
  league_id: string;
  user: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
  body: string;
  created_at: string;
  can_delete: boolean;
  reactions: TChatReaction[];
};

/** Nested player shape returned by the activity feed — matches the
 * backend's PlayerBrief schema, not src/types/player.ts's TPlayerBrief
 * (that one has different field names for a different endpoint). */
type TActivityPlayer = {
  id: string;
  name: string;
  position: string;
  photo_url: string | null;
};

export type TLeagueActivityEvent = {
  id: string;
  type: "trade" | "waiver" | "free_agent" | "dynasty_carryover" | "draft_pick" | "transfer";
  created_at: string;
  fantasy_team: { id: string; name: string; owner: TUser; created_at: string };
  actor: TUser | null;
  add_player: TActivityPlayer | null;
  drop_player: TActivityPlayer | null;
  window_number: number | null;
  cost_at_transfer: string | null;
  round_number: number | null;
  pick_number: number | null;
};

export type TPowerRankingEntry = {
  fantasy_team_id: string;
  team_name: string;
  rank: number;
  points: number;
  rank_delta: number | null;
  streak: number;
  manager_of_the_week: boolean;
};

export type TTradeFairness = {
  offered_value: number;
  requested_value: number;
  ratio: number;
  verdict: "balanced" | "lopsided";
};

export type TTradeOffer = {
  id: string;
  direction: "incoming" | "outgoing";
  from_team: { id: string; name: string };
  to_team: { id: string; name: string };
  offered: { id: string; name: string }[];
  requested: { id: string; name: string }[];
  status: TTradeStatus;
  veto_deadline: string | null;
  fairness: TTradeFairness;
};

export type TFantasyTeam = {
  id: string;
  name: string;
  current_budget: number | string;
  user: TUser;
  created_at: string;
  players?: TTeamPlayer[];
  team_players?: TTeamPlayer[];
};

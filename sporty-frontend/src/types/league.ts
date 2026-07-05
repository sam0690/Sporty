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
  is_active: boolean;
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
  allow_midseason_join?: boolean;
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
};

export type TLeaderboardEntry = {
  team_id: string;
  team_name: string;
  owner_name: string;
  points: number;
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
};

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
  created_at: string;
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
};

export type TConfirmTransfersRequest = {
  league_id: string;
  gameweek_id: string;
};

export type TConfirmTransfersResponse = {
  success: boolean;
  newBudget: number;
  transfersRemaining: number;
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

export type TTradeOffer = {
  id: string;
  direction: "incoming" | "outgoing";
  from_team: { id: string; name: string };
  to_team: { id: string; name: string };
  offered: { id: string; name: string }[];
  requested: { id: string; name: string }[];
  status: TTradeStatus;
  veto_deadline: string | null;
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

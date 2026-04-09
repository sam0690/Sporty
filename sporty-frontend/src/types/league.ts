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
  budget_per_team?: number;
  is_public?: boolean;
  sports: TLeagueSport[];
  member_count: number;
  invite_code?: string;
  status: string;
  squad_size: number;
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
  captain_id: string;
  vice_captain_id: string;
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
  draft_position: number | null;
  joined_at: string;
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
    cost: string;
    sport: {
      name: string;
      display_name: string;
    };
  };
  created_at: string;
  joined_at?: string;
};

export type TTransferPlayer = {
  id: string;
  name?: string;
  display_name?: string;
  position: string;
  real_team: string;
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
  lineup_deadline_at: string;
  lineup_locked: boolean;
};

export type TStageOutRequest = {
  league_id: string;
  gameweek_id: string;
  player_id: string;
};

export type TLeagueDashboardStats = {
  league_id: string;
  team_id: string;
  rank: number | null;
  gameweek_points: number | null;
  total_points: number;
  budget: number;
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

export type TFantasyTeam = {
  id: string;
  name: string;
  current_budget: number | string;
  user: TUser;
  created_at: string;
  players?: TTeamPlayer[];
  team_players?: TTeamPlayer[];
};

import { TSportBrief } from "./league";

export type TPlayer = {
  id: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  display_name: string;
  sport: TSportBrief;
  position: string;
  real_team: string;
  photo_url?: string | null;
  real_team_logo_url?: string | null;
  cost?: number;
  current_cost: number;
  is_available?: boolean;
  is_active: boolean;
  created_at: string;
  // Recency-weighted average of the last 3 gameweeks — a smarter stat, not
  // a trained prediction. null if the player has no stats in that window.
  projected_points?: number | null;
  // Biographical enrichment (from TheSportsDB) - not every player has every field.
  nationality?: string | null;
  date_of_birth?: string | null;
  height?: string | null;
  weight?: string | null;
  jersey_number?: number | null;
  bio?: string | null;
  wage?: string | null;
  signing_fee?: string | null;
  date_signed?: string | null;
  agent?: string | null;
  social_links?: Record<string, string> | null;
};

// One entry of an explainable fantasy-points breakdown (backend engine output).
// Generic on purpose so the UI renders any sport's actions without hardcoding.
export type TScoreEvent = {
  action: string;
  position?: string | null;
  count?: number;
  mode?: string;
  points_each?: number;
  subtotal: number;
  match_id?: string;
};

export type TFantasyPointsBreakdown = TScoreEvent[];

export type TPlayerGameweekStat = {
  player: TPlayerBrief;
  transfer_window: { id: string; number: number; start_at: string; end_at: string };
  minutes_played: number;
  fantasy_points: number;
  breakdown?: TFantasyPointsBreakdown | null;
  football_stat?: {
    goals: number;
    assists: number;
    clean_sheets: number;
    yellow_cards: number;
    red_cards: number;
    own_goals: number;
    penalties_saved: number;
    penalties_missed: number;
    saves: number;
    goals_conceded: number;
    bonus: number;
    // Advanced metrics (Phase 3). Optional so older rows stay valid.
    tackles?: number;
    interceptions?: number;
    blocks?: number;
    clearances?: number;
    key_passes?: number;
    shots_on_target?: number;
    dribbles_won?: number;
    duels_won?: number;
    rating?: number | null;
  } | null;
  cricket_stat?: {
    runs_scored?: number | null;
    balls_faced?: number | null;
    wickets_taken?: number | null;
    maidens?: number | null;
    economy_rate?: number | null;
    catches?: number | null;
    run_outs?: number | null;
  } | null;
};

export type TPlayerBrief = {
  id: string;
  display_name: string;
  sport_name: string;
  position: string;
  real_team: string;
  photo_url?: string | null;
  real_team_logo_url?: string | null;
  current_cost: number;
};

export type TPlayerRecentStatsResponse = {
  items: TPlayerGameweekStat[];
};

export type TPlayerListResponse = {
  items: TPlayer[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
};

export type TPlayerFilter = {
  name?: string;
  sport_name?: string;
  position?: string;
  real_team?: string;
  minCost?: number;
  maxCost?: number;
  league_id?: string;
  page?: number;
  page_size?: number;
  search?: string;
  min_cost?: number;
  max_cost?: number;
};

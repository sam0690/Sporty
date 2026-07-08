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

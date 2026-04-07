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
  cost?: number;
  current_cost: number;
  is_available?: boolean;
  is_active: boolean;
  created_at: string;
};

export type TPlayerBrief = {
  id: string;
  display_name: string;
  sport_name: string;
  position: string;
  real_team: string;
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
  sport_name?: string;
  position?: string;
  real_team?: string;
  min_cost?: number;
  max_cost?: number;
  search?: string;
  league_id?: string;
  page?: number;
  page_size?: number;
};

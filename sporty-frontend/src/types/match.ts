export type TMatchStatus =
  | "scheduled"
  | "live"
  | "finished"
  | "postponed"
  | "cancelled";

export type TMatch = {
  id: string;
  external_api_id: string;
  sport: string;
  home_team: string;
  away_team: string;
  match_date: string;
  status: TMatchStatus | string;
  competition: string;
  home_score: number | null;
  away_score: number | null;
};

export type TMatchListResponse = {
  items: TMatch[];
  total: number;
};

export type TMatchFilter = {
  status?: string;
  sport_name?: string;
  limit?: number;
};

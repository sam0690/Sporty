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
  home_team_logo_url: string | null;
  away_team_logo_url: string | null;
  match_date: string;
  status: TMatchStatus | string;
  competition: string;
  home_score: number | null;
  away_score: number | null;
  /** Current match minute — only populated by the live-for-favourites
   *  endpoint (null elsewhere). */
  minute?: number | null;
};

export type TMatchListResponse = {
  items: TMatch[];
  total: number;
};

export type TMatchFilter = {
  status?: string;
  sport_name?: string;
  /** YYYY-MM-DD, filters to a single calendar day (UTC). */
  date?: string;
  limit?: number;
};

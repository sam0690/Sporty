export type WSMessageEvent =
  | "MATCH_EVENT"
  | "FANTASY_POINTS_DELTA"
  | "SCORE_UPDATE"
  | "LINEUP_CHANGE";

export type WSMessage = {
  event: WSMessageEvent;
  data: Record<string, unknown>;
};

export type Score = {
  home: number;
  away: number;
};

export type MatchSnapshot = {
  match_id: string;
  score: Score;
  status: string;
  match_date: string | null;
  lineups: Record<string, unknown>;
  player_points: Record<string, number>;
};

export type FantasyPointsDelta = {
  match_id: string;
  player_id: string;
  delta: number;
  total_points: number;
  ts: number;
};

export type ScoreUpdate = {
  match_id: string;
  home: number;
  away: number;
  minute?: number;
  // Present on feeder-driven updates ("live" | "finished").
  status?: string;
};

export type MatchPrediction = {
  sporty_match_id: string;
  home_win_prob: number;
  draw_prob: number;
  away_win_prob: number;
  model_version: string;
};

export type PlayerRating = {
  sporty_player_id: string | null;
  rating: number;
  goals: number;
  assists: number;
  minutes_played: number;
  events: string[];
};

export type MatchRatings = {
  sporty_match_id: string;
  sport: string;
  man_of_match_sporty_player_id: string | null;
  ratings: PlayerRating[];
};

export type LineupChange = {
  match_id: string;
  team_id: string;
  player_in: string;
  player_out: string;
  minute?: number;
};

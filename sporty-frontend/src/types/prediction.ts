export type TPrediction = {
  id: string;
  match_id: string;
  predicted_home: number;
  predicted_away: number;
  points_awarded: number | null;
  home_team: string;
  away_team: string;
  match_date: string;
  match_status: string;
  home_score: number | null;
  away_score: number | null;
  locked: boolean;
};

export type TPredictionListResponse = {
  items: TPrediction[];
  total: number;
};

export type TPredictionCreate = {
  match_id: string;
  predicted_home: number;
  predicted_away: number;
};

export type TLeaderboardRow = {
  user_id: string;
  username: string;
  total_points: number;
  predictions_made: number;
  exact_scores: number;
  rank: number;
};

export type TLeaderboardResponse = {
  items: TLeaderboardRow[];
  total: number;
  me: TLeaderboardRow | null;
};

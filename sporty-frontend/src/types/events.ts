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

export type PlayerInfo = {
  name: string | null;
  position?: string | null;
  team?: string | null;
  photo_url?: string | null;
};

export type MatchEvent = {
  event_id: string;
  type: string;
  minute: number | null;
  player_id: string | null;
  player_name?: string | null;
  team?: string | null;
  // Substitutions only: the player coming OFF (paired with player_id/name,
  // which is the player coming ON).
  related_player_id?: string | null;
  related_player_name?: string | null;
  related_team?: string | null;
  // Feeder detail: {penalty: true} on penalty goals, {severity} on injuries,
  // {reason: "injury"} on injury-forced substitutions.
  extra?: Record<string, unknown> | null;
};

/** Team match stats booked at full time (possession, shots, xG, pass accuracy).
 *  Values are the provider's raw ones — "52%", 1.83, 0, or null when the stat
 *  wasn't reported — so the UI must format and null-check, not assume numbers. */
export type MatchTeamStats = {
  home: Record<string, string | number | null>;
  away: Record<string, string | number | null>;
};

/** Possession split — from the feeder while live, else derived at FT from the
 *  team stat sheet's "Ball Possession". */
export type Possession = {
  home_pct: number;
  away_pct: number;
};

/** Penalty-shootout result for knockout matches tied after extra time. */
export type Shootout = {
  home: number;
  away: number;
  winner_sporty_team_id: string | null;
};

export type LineupPlayer = {
  player_id: string;
  name: string | null;
  /** Our stored (fantasy) position — not necessarily what they played today. */
  position?: string | null;
  team?: string | null;
  photo_url?: string | null;
  /**
   * Provider slot as "row:col" — row 1 is the keeper, row 2 the defensive
   * line; column ascends left → right from the team's own perspective. Drives
   * the real pitch shape. Starters only, and absent for feeder pushes and
   * competitions the provider doesn't cover.
   */
  grid?: string | null;
  /** Position actually played this match (G/D/M/F). */
  match_position?: string | null;
};

export type MatchLineups = {
  home: LineupPlayer[];
  away: LineupPlayer[];
  // Bench groups — absent on snapshots from before the feeder pushed them.
  home_bench?: LineupPlayer[];
  away_bench?: LineupPlayer[];
  // The provider's own shape ("4-2-3-1"). Absent for feeder pushes and for
  // competitions API-Football doesn't cover, so the pitch keeps deriving a
  // label from positions as its fallback.
  home_formation?: string | null;
  away_formation?: string | null;
};

export type MatchSnapshot = {
  match_id: string;
  /** Sport slug ("football" | "basketball" | …); drives which lineup view. */
  sport?: string | null;
  home_team: string | null;
  away_team: string | null;
  home_team_logo_url: string | null;
  away_team_logo_url: string | null;
  score: Score;
  status: string;
  match_date: string | null;
  players: Record<string, PlayerInfo>;
  events: MatchEvent[];
  lineups: MatchLineups;
  player_points: Record<string, number>;
  /** Per-player fantasy breakdown for the match centre (populated at FT). */
  player_breakdowns?: Record<string, MatchPlayerBreakdown>;
  possession?: Possession | null;
  shootout?: Shootout | null;
  /** Team stat sheet; absent until full time and for non-football matches. */
  team_stats?: MatchTeamStats | null;
};

export type MatchPlayerBreakdown = {
  position: string | null;
  points: number;
  bonus: number;
  rating: number | null;
  breakdown: import("./player").TScoreEvent[];
  /** The player's real match stat line, booked at full time (minutes,
   *  shots_on_target, tackles, duels_won, …). Empty until FT. */
  stats?: Record<string, number | null> | null;
};

export type FantasyPointsDelta = {
  match_id: string;
  player_id: string;
  delta: number;
  total_points: number;
  ts: number;
};

// Raw event shape pushed inside a feeder SCORE_UPDATE (FeedEvent.model_dump()
// enriched server-side with player_name/team). Keys differ from MatchEvent:
// the feed uses event_type/sporty_player_id; the snapshot uses type/player_id.
export type FeedEventPayload = {
  event_id: string;
  event_type: string;
  sporty_player_id?: string | null;
  minute?: number | null;
  player_name?: string | null;
  team?: string | null;
  // Substitutions only: the player coming OFF.
  related_sporty_player_id?: string | null;
  related_player_name?: string | null;
  related_team?: string | null;
  extra?: Record<string, unknown> | null;
};

export type ScoreUpdate = {
  match_id: string;
  home: number;
  away: number;
  minute?: number;
  // Present on feeder-driven updates ("live" | "finished").
  status?: string;
  // Match events bundled with the score push (goals/cards/assists/etc.).
  events?: FeedEventPayload[];
  // Football extras (absent on basketball / older pushes).
  possession?: Possession | null;
  shootout?: Shootout | null;
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
  /** Display name resolved server-side; null when the feeder id is unmapped. */
  name?: string | null;
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
  /** Display name for the MOTM; null when unmapped. */
  man_of_match_name?: string | null;
  ratings: PlayerRating[];
};

export type LineupChange = {
  match_id: string;
  team_id: string;
  player_in: string;
  player_out: string;
  /** Display names resolved server-side (feeder substitutions); the ids are
   *  the fallback when a player is unmapped. */
  player_in_name?: string | null;
  player_out_name?: string | null;
  minute?: number;
};

// Public competition pages (real competitions: EPL / La Liga / Bundesliga).
// Standings, scorers, and matches mirror the football-data.org shapes the
// backend caches and passes through.

export type TCompetitionMeta = {
  tag: string; // "EPL" | "LALIGA" | "BUNDESLIGA"
  name: string;
  fdo_code: string;
};

export type TCompetitionsIndex = {
  competitions: TCompetitionMeta[];
  seasons: number[]; // newest first
  current_season: number;
};

export type TStandingRow = {
  position: number;
  team: { id: number; name: string; crest?: string | null };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  form?: string | null; // "W,L,D,W,W"
};

export type TScorer = {
  player: { id: number; name: string; nationality?: string | null };
  team: { id: number; name: string; crest?: string | null };
  playedMatches?: number | null;
  goals: number | null;
  assists: number | null;
  penalties: number | null;
};

export type TCompetitionMatch = {
  id: number;
  utcDate: string;
  status: string; // TIMED | SCHEDULED | IN_PLAY | PAUSED | FINISHED | POSTPONED ...
  matchday: number | null;
  homeTeam: { id: number; name: string; crest?: string | null };
  awayTeam: { id: number; name: string; crest?: string | null };
  score?: {
    fullTime?: { home: number | null; away: number | null };
  };
};

type Envelope<K extends string, D> = {
  competition: string;
  season: number;
  kind: K;
  data: D;
};

export type TStandingsResponse = Envelope<
  "standings",
  { standings: { type?: string; table: TStandingRow[] }[] }
>;
export type TScorersResponse = Envelope<"scorers", { scorers: TScorer[] }>;
export type TCompetitionMatchesResponse = Envelope<
  "matches",
  { matches: TCompetitionMatch[] }
>;

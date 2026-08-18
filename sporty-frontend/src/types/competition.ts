// Public competition pages (real competitions: EPL / La Liga / Bundesliga /
// UCL / NBA). The football competitions mirror the football-data.org shapes
// the backend caches and passes through; the NBA is computed by the backend
// from our own match rows into the SAME envelope, with basketball columns in
// place of the football ones.

export type TCompetitionSport = "football" | "basketball";

export type TCompetitionMeta = {
  tag: string; // "EPL" | "LALIGA" | "BUNDESLIGA" | "UCL" | "NBA"
  name: string;
  sport?: TCompetitionSport;
  fdo_code: string | null; // null for competitions we compute ourselves
  // Which tabs this competition can serve. The NBA has no top-scorers
  // equivalent, so its page must not request `scorers`.
  kinds?: string[];
  seasons?: number[]; // per-competition; NBA's range differs from football's
};

export type TCompetitionsIndex = {
  competitions: TCompetitionMeta[];
  seasons: number[]; // newest first — football default, see meta.seasons
  current_season: number;
};

// One row of a standings table. Football and basketball share the identity and
// played/won/lost columns; everything below that is sport-specific and present
// only for its own sport — read them through `isBasketballRow`.
export type TStandingRow = {
  position: number;
  team: {
    id: number | string;
    name: string;
    shortName?: string | null;
    tla?: string | null;
    crest?: string | null;
  };
  playedGames: number;
  won: number;
  lost: number;
  form?: string | null; // "W,L,D,W,W" (football) | "W,L,W,W,W" (NBA)

  // Football only
  draw?: number;
  points?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  goalDifference?: number;

  // Basketball only
  winPct?: number; // .000–1.000
  gamesBehind?: number; // 0 for the group leader
  streak?: string | null; // "W3" | "L2"
  conference?: string | null;
  division?: string | null;
};

/** A row is basketball-shaped when it carries a win percentage. */
export function isBasketballRow(row: TStandingRow): boolean {
  return row.winPct !== undefined;
}

export type TScorer = {
  player: {
    id: number;
    name: string;
    nationality?: string | null;
    flag_url?: string | null;
  };
  team: { id: number; name: string; crest?: string | null };
  playedMatches?: number | null;
  goals: number | null;
  assists: number | null;
  penalties: number | null;
};

export type TCompetitionTeamRef = {
  id: number | string | null;
  name: string;
  shortName?: string | null;
  tla?: string | null;
  crest?: string | null;
};

export type TCompetitionMatch = {
  // football-data.org uses numeric ids; NBA fixtures carry ours ("bdl:<id>").
  id: number | string;
  utcDate: string;
  status: string; // TIMED | SCHEDULED | IN_PLAY | PAUSED | FINISHED | POSTPONED ...
  // null for the NBA — it has no matchweeks, so its fixtures group by date.
  matchday: number | null;
  // Knockout rounds carry a stage (LAST_16 / QUARTER_FINALS / SEMI_FINALS /
  // FINAL / PLAYOFFS); the league phase is LEAGUE_STAGE (or GROUP_STAGE).
  stage?: string | null;
  homeTeam: TCompetitionTeamRef;
  awayTeam: TCompetitionTeamRef;
  score?: {
    fullTime?: { home: number | null; away: number | null };
    halfTime?: { home: number | null; away: number | null };
    winner?: string | null; // HOME_TEAM | AWAY_TEAM | DRAW
  };
};

export type TCompetitionMatchDetail = {
  competition: string; // tag, e.g. "UCL"
  match: TCompetitionMatch;
};

type Envelope<K extends string, D> = {
  competition: string;
  season: number;
  kind: K;
  data: D;
};

export type TStandingsGroup = {
  // TOTAL | HOME | AWAY (football) · TOTAL | CONFERENCE | DIVISION (NBA)
  type?: string;
  // Display name for the group: "League", "East", "Atlantic", or a UCL group.
  group?: string | null;
  table: TStandingRow[];
};

export type TStandingsResponse = Envelope<
  "standings",
  {
    standings: TStandingsGroup[];
    // football-data.org's season object — startDate/currentMatchday reveal
    // whether the labelled season has actually kicked off yet. The NBA payload
    // fills startDate/endDate plus its own label and gamesPlayed.
    season?: {
      startDate?: string;
      endDate?: string;
      currentMatchday?: number | null;
      label?: string; // "2026-27"
      gamesPlayed?: number;
    };
  }
>;
export type TScorersResponse = Envelope<"scorers", { scorers: TScorer[] }>;
export type TCompetitionMatchesResponse = Envelope<
  "matches",
  { matches: TCompetitionMatch[] }
>;

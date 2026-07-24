// Unified fixtures (GET /api/v1/fixtures) — fantasy matches + display-only
// competition matches (Champions League) merged for one day. Mirrors the
// backend FixtureResponse.

export type TFixture = {
  id: string;
  /** "fantasy" -> live match view /match/{id}; a competition tag ("UCL") ->
   *  the competition match page /competitions/<tag>/match/{id}. */
  source: string;
  sport: string;
  competition: string;
  home_team: string;
  away_team: string;
  home_team_logo_url: string | null;
  away_team_logo_url: string | null;
  match_date: string; // ISO
  status: string; // scheduled | live | finished | postponed | cancelled
  home_score: number | null;
  away_score: number | null;
  stage: string | null; // knockout round label (cup competitions)
};

export type TFixtureListResponse = {
  items: TFixture[];
  total: number;
  date: string; // YYYY-MM-DD
};

export type TFixtureFilter = {
  /** YYYY-MM-DD (UTC); defaults to today server-side. */
  date?: string;
  sport_name?: string;
};

/** Detail-page href for a fixture, honouring its source. */
export function fixtureHref(fx: TFixture): string {
  return fx.source === "fantasy"
    ? `/match/${fx.id}`
    : `/competitions/${fx.source.toLowerCase()}/match/${fx.id}`;
}

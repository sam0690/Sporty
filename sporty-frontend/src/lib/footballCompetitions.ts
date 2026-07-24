// Football competitions a league's player pool can be scoped to. Mirrors the
// backend's app/services/sync/football_competitions.py tags and the
// RealTeam.competition values. "ALL" is a UI-only sentinel meaning "no scope"
// (the backend receives no competition_filters entry for the sport).

export const FOOTBALL_COMPETITION_TAGS = ["EPL", "LALIGA", "BUNDESLIGA"] as const;
export type FootballCompetitionTag = (typeof FOOTBALL_COMPETITION_TAGS)[number];
export type CompetitionChoice = "ALL" | FootballCompetitionTag;

// Icons are rendered by consumers (lucide Globe for "ALL", the football sport
// glyph for competitions) — no emoji flags.
type CompetitionMeta = {
  value: CompetitionChoice;
  label: string;
  short: string;
};

export const FOOTBALL_COMPETITIONS: CompetitionMeta[] = [
  { value: "ALL", label: "All Leagues", short: "All" },
  { value: "EPL", label: "Premier League", short: "EPL" },
  { value: "LALIGA", label: "La Liga", short: "La Liga" },
  { value: "BUNDESLIGA", label: "Bundesliga", short: "Bundes." },
];

// Display-only meta (competition pages), NOT fantasy-selectable — kept out of
// the picker array above so it can never be chosen for a league's pool.
type DisplayMeta = { label: string; short: string };

const DISPLAY_ONLY: Record<string, DisplayMeta> = {
  UCL: { label: "Champions League", short: "UCL" },
};

const BY_TAG: Record<string, DisplayMeta> = {
  ...Object.fromEntries(FOOTBALL_COMPETITIONS.map((c) => [c.value, c])),
  ...DISPLAY_ONLY,
};

/** Display meta for a stored tag ("EPL"|"LALIGA"|"BUNDESLIGA"|"UCL"), or null. */
export function competitionMeta(
  tag: string | null | undefined,
): DisplayMeta | null {
  if (!tag) return null;
  return BY_TAG[tag] ?? null;
}

// Competition display NAME (as stored on Match.competition / FixtureResponse)
// -> tag, for the competitions that have a standings page. NBA/Cricket return
// null (no competition page).
const NAME_TO_TAG: Record<string, string> = {
  "Premier League": "EPL",
  "La Liga": "LALIGA",
  Bundesliga: "BUNDESLIGA",
  "Champions League": "UCL",
};

/** Route tag (lowercase, e.g. "epl") for a competition's display name, or null
 *  if it has no competition/standings page. */
export function competitionRouteTag(name: string | null | undefined): string | null {
  if (!name) return null;
  const tag = NAME_TO_TAG[name];
  return tag ? tag.toLowerCase() : null;
}


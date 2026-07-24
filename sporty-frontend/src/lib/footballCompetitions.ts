// Football competitions a league's player pool can be scoped to. Mirrors the
// backend's app/services/sync/football_competitions.py tags and the
// RealTeam.competition values. "ALL" is a UI-only sentinel meaning "no scope"
// (the backend receives no competition_filters entry for the sport).

export const FOOTBALL_COMPETITION_TAGS = ["EPL", "LALIGA", "BUNDESLIGA"] as const;
export type FootballCompetitionTag = (typeof FOOTBALL_COMPETITION_TAGS)[number];
export type CompetitionChoice = "ALL" | FootballCompetitionTag;

type CompetitionMeta = {
  value: CompetitionChoice;
  label: string;
  short: string;
  flag: string;
};

export const FOOTBALL_COMPETITIONS: CompetitionMeta[] = [
  { value: "ALL", label: "All Leagues", short: "All", flag: "🌍" },
  { value: "EPL", label: "Premier League", short: "EPL", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { value: "LALIGA", label: "La Liga", short: "La Liga", flag: "🇪🇸" },
  { value: "BUNDESLIGA", label: "Bundesliga", short: "Bundes.", flag: "🇩🇪" },
];

// Display-only meta (competition pages), NOT fantasy-selectable — kept out of
// the picker array above so it can never be chosen for a league's pool.
type DisplayMeta = { label: string; short: string; flag: string };

const DISPLAY_ONLY: Record<string, DisplayMeta> = {
  UCL: { label: "Champions League", short: "UCL", flag: "🏆" },
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


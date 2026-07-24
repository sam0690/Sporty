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

const BY_TAG: Record<string, CompetitionMeta> = Object.fromEntries(
  FOOTBALL_COMPETITIONS.map((c) => [c.value, c]),
);

/** Display meta for a stored tag ("EPL"|"LALIGA"|"BUNDESLIGA"), or null. */
export function competitionMeta(
  tag: string | null | undefined,
): CompetitionMeta | null {
  if (!tag) return null;
  return BY_TAG[tag] ?? null;
}

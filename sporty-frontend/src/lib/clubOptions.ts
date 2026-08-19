// Options for the shared club filter (src/components/ui/ClubFilter.tsx).
//
// Clubs come from GET /players/teams as a flat list; this buckets them under
// their competition so a 60-club dropdown reads as three league sections.
// Kept pure and separate from the component so it is testable — vitest only
// picks up src/**/*.test.ts, there is no component-test setup.

import type { SelectOption } from "@/components/ui/Select";
import {
  FOOTBALL_COMPETITION_TAGS,
  competitionMeta,
} from "@/lib/footballCompetitions";

/** Sentinel for "no club filter", matching the "All" used for position/sport. */
export const ALL_CLUBS = "All";

/** Structural shape of TTeamBrief — src/lib does not import from src/services. */
export type ClubTeam = {
  name: string;
  competition?: string | null;
  sport?: { name?: string | null; display_name?: string | null } | null;
};

const OTHER = "Other";

// Fantasy leagues first, in their canonical order; then other sports; then
// the untracked bucket.
const TAG_RANK = new Map<string, number>(
  FOOTBALL_COMPETITION_TAGS.map((tag, index) => [tag, index]),
);
const SPORT_RANK = 10;
const OTHER_RANK = 20;

function groupFor(team: ClubTeam): string {
  const meta = competitionMeta(team.competition);
  if (meta) {
    return meta.label;
  }
  // A football club with no competition tag is relegated, untracked or a
  // feeder test team — it must not sit under a league heading.
  if (team.sport?.name === "football") {
    return OTHER;
  }
  return team.sport?.display_name?.trim() || OTHER;
}

function rankFor(team: ClubTeam, group: string): number {
  return TAG_RANK.get(team.competition ?? "") ?? (group === OTHER ? OTHER_RANK : SPORT_RANK);
}

/**
 * Grouped, sorted club options with "All Clubs" pinned first.
 *
 * `value` is the club NAME, not the id — the backend's `real_team` filter
 * matches on the denormalised Player.real_team string.
 *
 * @param restrictTo when given, keep only these club names (e.g. the clubs a
 *   manager's own squad spans, so the roster filter offers 8 clubs not 60).
 */
export function buildClubOptions(
  teams: ClubTeam[] | undefined,
  restrictTo?: string[],
): SelectOption[] {
  const allowed = restrictTo ? new Set(restrictTo) : null;

  const rows = (teams ?? [])
    .filter((team) => team.name && (!allowed || allowed.has(team.name)))
    .map((team) => {
      const group = groupFor(team);
      return { value: team.name, label: team.name, group, rank: rankFor(team, group) };
    });

  // Club names are unique per sport, not globally — drop any collision so the
  // ambiguous name-based filter never renders two identical options.
  const seen = new Set<string>();
  const unique = rows.filter((row) => {
    if (seen.has(row.value)) return false;
    seen.add(row.value);
    return true;
  });

  unique.sort(
    (a, b) =>
      a.rank - b.rank ||
      a.group.localeCompare(b.group) ||
      a.value.localeCompare(b.value),
  );

  return [
    { value: ALL_CLUBS, label: "All Clubs" },
    ...unique.map(({ value, label, group }) => ({ value, label, group })),
  ];
}

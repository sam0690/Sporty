/**
 * Pure squad-composition rules shared by the draft room and the budget team
 * builder. These mirror what the backend enforces in
 * app/league/sportConfigs.py — position minimums and max-per-club arrive from
 * the league payload so the frontend can't drift from the server; only the
 * squad sizes and multisport split are mirrored here as constants.
 */

export const SQUAD_SIZES: Record<string, number> = {
  football: 15,
  basketball: 13,
  multisport: 15,
};

export const MULTISPORT_MIN_BY_SPORT = {
  football: 8,
  basketball: 7,
} as const;

export type LeagueSportKind = "football" | "basketball" | "multisport";

/** A league with more than one sport is multisport, not its first sport. */
export function normalizeLeagueSport(
  sports: Array<{ sport: { name: string } }> | undefined,
): LeagueSportKind {
  if (!sports || sports.length === 0 || sports.length > 1) {
    return "multisport";
  }
  const name = sports[0]?.sport?.name;
  return name === "football" || name === "basketball" ? name : "multisport";
}

export type SquadPlayer = {
  sport: string;
  position: string;
  realTeam?: string;
};

export type SquadRule = {
  key: string;
  label: string;
  detail: string;
  satisfied: boolean;
};

export type ClubWarning = { club: string; count: number; max: number };

export function countBy(
  players: SquadPlayer[],
  field: "sport" | "position",
): Record<string, number> {
  return players.reduce<Record<string, number>>((acc, player) => {
    const key = player[field];
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

/** Clubs at or past the max-per-club cap — only those are worth surfacing. */
export function clubWarnings(
  players: SquadPlayer[],
  maxPerClub: number | null | undefined,
): ClubWarning[] {
  if (!maxPerClub) {
    return [];
  }
  const counts = players.reduce<Record<string, number>>((acc, player) => {
    const club = player.realTeam || "Unknown club";
    acc[club] = (acc[club] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts)
    .filter(([, count]) => count >= maxPerClub)
    .map(([club, count]) => ({ club, count, max: maxPerClub }));
}

export type SquadValidationInput = {
  players: SquadPlayer[];
  leagueSport: "football" | "basketball" | "multisport";
  /** Draft picks have no cost cap, so budget is only a budget-mode rule. */
  includeBudgetRule: boolean;
  remainingBudget: number;
  /** From the league payload (backend sportConfigs) — never hardcoded. */
  positionMinimums: Record<string, number>;
};

export function buildSquadValidation({
  players,
  leagueSport,
  includeBudgetRule,
  remainingBudget,
  positionMinimums,
}: SquadValidationInput): SquadRule[] {
  const requiredPlayers = SQUAD_SIZES[leagueSport];
  const sportCounts = countBy(players, "sport");
  const positionCounts = countBy(players, "position");

  return [
    {
      key: "size",
      label: "Squad size",
      detail: `${players.length}/${requiredPlayers}`,
      satisfied: players.length === requiredPlayers,
    },
    ...(includeBudgetRule
      ? [
          {
            key: "budget",
            label: "Within budget",
            detail: `£${remainingBudget.toFixed(1)}M left`,
            satisfied: remainingBudget >= 0,
          },
        ]
      : []),
    ...(leagueSport === "multisport"
      ? [
          {
            key: "football",
            label: "Football minimum",
            detail: `${sportCounts.football ?? 0}/${MULTISPORT_MIN_BY_SPORT.football}`,
            satisfied:
              (sportCounts.football ?? 0) >= MULTISPORT_MIN_BY_SPORT.football,
          },
          {
            key: "basketball",
            label: "Basketball minimum",
            detail: `${sportCounts.basketball ?? 0}/${MULTISPORT_MIN_BY_SPORT.basketball}`,
            satisfied:
              (sportCounts.basketball ?? 0) >=
              MULTISPORT_MIN_BY_SPORT.basketball,
          },
        ]
      : []),
    ...Object.entries(positionMinimums).map(([position, required]) => ({
      key: `position-${position}`,
      label: `${position} minimum`,
      detail: `${positionCounts[position] ?? 0}/${required}`,
      satisfied: (positionCounts[position] ?? 0) >= required,
    })),
  ];
}

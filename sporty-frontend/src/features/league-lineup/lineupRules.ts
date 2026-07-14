import { MULTISPORT_STARTER_REQUIREMENTS } from "@/lib/formation/formationEngine";

export { MULTISPORT_STARTER_REQUIREMENTS };

/** Pure lineup rules/helpers extracted from useLineupState so they can be
 * unit-tested without React (the hook re-exports what its consumers need). */

export type HeaderSport = "football" | "basketball" | "cricket" | "multisport";

export const SPORT_LINEUP_RULES = {
  football: { starters: 11, bench: 4, total: 15, label: "Football" },
  basketball: { starters: 5, bench: 8, total: 13, label: "Basketball" },
  multisport: { starters: 9, bench: 6, total: 15, label: "Multisport" },
} as const;

export type LineupSportType = keyof typeof SPORT_LINEUP_RULES;

export const MULTISPORT_SQUAD_MIN = 13;
export const MULTISPORT_SQUAD_MAX = 15;

export function detectLineupSport(
  players: { sportName: string }[],
): LineupSportType {
  const sportSet = new Set(players.map((player) => player.sportName));
  if (sportSet.size > 1) {
    return "multisport";
  }

  const sport = Array.from(sportSet)[0];
  if (sport === "football" || sport === "basketball") {
    return sport;
  }

  return "multisport";
}

export function groupPlayersBySport<T extends { sportDisplayName: string }>(
  players: T[],
) {
  return players.reduce<Record<string, T[]>>((acc, player) => {
    if (!acc[player.sportDisplayName]) {
      acc[player.sportDisplayName] = [];
    }

    acc[player.sportDisplayName].push(player);
    return acc;
  }, {});
}

/** Order-independent identity of a lineup (who starts, who wears the bands) —
 * used to detect server refreshes and unsaved local edits. */
export function lineupFingerprint(
  players: {
    playerId: string;
    isStarter: boolean;
    isCaptain: boolean;
    isViceCaptain: boolean;
  }[],
): string {
  return [...players]
    .sort((a, b) => a.playerId.localeCompare(b.playerId))
    .map(
      (player) =>
        `${player.playerId}:${player.isStarter ? 1 : 0}:${player.isCaptain ? 1 : 0}:${player.isViceCaptain ? 1 : 0}`,
    )
    .join("|");
}

export function positionBaselineProjection(position: string): number {
  const normalized = position.trim().toUpperCase();
  if (normalized.includes("GK") || normalized === "GKP") return 4.2;
  if (normalized.includes("DEF") || normalized === "D") return 4.6;
  if (normalized.includes("MID") || normalized === "M") return 5.4;
  if (
    normalized.includes("FWD") ||
    normalized.includes("ATT") ||
    normalized === "F"
  ) {
    return 5.9;
  }
  if (normalized === "PG") return 5.3;
  if (normalized === "SG") return 5.2;
  if (normalized === "SF") return 5.1;
  if (normalized === "PF") return 5.4;
  if (normalized === "C") return 5.6;
  return 4.8;
}

export function parseNumericCost(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

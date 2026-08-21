import type { TLeaderboardEntry } from "@/types/league";

/**
 * Why a leaderboard row shows no points.
 *
 * Both states are legitimate and used to be invisible: the row was either
 * dropped from the response entirely or rendered as an unexplained 0, which
 * left managers asking why their team didn't score.
 *
 *  - `no_squad`       — joined the league but never built a squad.
 *  - `pending_window` — joined midseason; their first scoring gameweek is
 *                       still ahead, so they legitimately score nothing yet.
 */
export type NotScoringReason = "no_squad" | "pending_window";

export function notScoringReason(
  entry: TLeaderboardEntry,
  currentGameweek: number | null | undefined,
): NotScoringReason | null {
  if (entry.team_id === null) return "no_squad";
  if (
    entry.eligible_from_gameweek != null &&
    currentGameweek != null &&
    entry.eligible_from_gameweek > currentGameweek
  ) {
    return "pending_window";
  }
  return null;
}

/**
 * Points-desc, but every non-scoring row sinks to the bottom.
 *
 * Without this a teamless row ties on 0 with everyone else and can land at
 * position 0 — which reads as "league leader" before a ball is kicked.
 */
export function sortLeaderboardEntries(
  entries: TLeaderboardEntry[],
  currentGameweek: number | null | undefined,
): TLeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    const aIdle = notScoringReason(a, currentGameweek) ? 1 : 0;
    const bIdle = notScoringReason(b, currentGameweek) ? 1 : 0;
    if (aIdle !== bIdle) return aIdle - bIdle;
    return Number(b.points) - Number(a.points);
  });
}

export const NOT_SCORING_LABEL: Record<NotScoringReason, string> = {
  no_squad: "No squad yet",
  pending_window: "Not scoring yet",
};

export function notScoringTooltip(
  reason: NotScoringReason,
  eligibleFromGameweek?: number | null,
): string {
  return reason === "no_squad"
    ? "This manager joined the league but hasn't built a squad, so there's nothing to score yet. They can still build one — it will score from the next gameweek onwards."
    : `This manager joined after the season started. Their squad starts scoring from gameweek ${eligibleFromGameweek ?? "?"}, so earlier gameweeks count as zero.`;
}

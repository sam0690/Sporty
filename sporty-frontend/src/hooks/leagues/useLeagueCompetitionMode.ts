import { useMemo } from "react";
import type { TCompetitionType, TLeague } from "@/types";

type LeagueModeSource = Pick<TLeague, "competition_type" | "draft_mode">;

function deriveCompetitionType(
  league?: LeagueModeSource | null,
): TCompetitionType {
  if (
    league?.competition_type === "draft" ||
    league?.competition_type === "budget"
  ) {
    return league.competition_type;
  }

  return league?.draft_mode ? "draft" : "budget";
}

export function useLeagueCompetitionMode(league?: LeagueModeSource | null) {
  const competitionType = useMemo(
    () => deriveCompetitionType(league),
    [league],
  );

  return {
    competitionType,
    isDraftMode: competitionType === "draft",
    isBudgetMode: competitionType === "budget",
  };
}

export { deriveCompetitionType };

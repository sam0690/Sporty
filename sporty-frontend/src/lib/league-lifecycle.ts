import type { TCompetitionType, TLeagueStatus } from "@/types/league";

type LeagueModeSource = {
  competition_type?: TCompetitionType;
  draft_mode?: boolean;
};

const DRAFT_LIFECYCLE: TLeagueStatus[] = [
  "setup",
  "drafting",
  "active",
  "completed",
];

const BUDGET_LIFECYCLE: TLeagueStatus[] = ["setup", "active", "completed"];

function getCompetitionType(
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

export function getLifecycleStatusesForLeague(
  league?: LeagueModeSource | null,
): TLeagueStatus[] {
  return getCompetitionType(league) === "draft"
    ? DRAFT_LIFECYCLE
    : BUDGET_LIFECYCLE;
}

export function getLifecycleStatusLabel(
  status: TLeagueStatus,
  league?: LeagueModeSource | null,
): string {
  if (status === "drafting") {
    return getCompetitionType(league) === "draft" ? "Drafted" : "Setup";
  }

  return status.charAt(0).toUpperCase() + status.slice(1);
}

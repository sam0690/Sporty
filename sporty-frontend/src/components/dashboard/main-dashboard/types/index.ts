import { SportKind } from "@/components/dashboard/shared/formation/sportRegistry";

export type DashboardNavItem = {
  label: string;
  href: string;
};

export type OverviewStat = {
  label: string;
  value: string;
  change: string;
};

export type TeamPlayer = {
  id: string;
  name: string;
  position: string;
  sport: SportKind;
  team?: string;
  photoUrl?: string | null;
  points: number | null;
  isStarter?: boolean;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
};

export type TeamPreviewSlide = {
  leagueId: string;
  leagueName: string;
  gameweek: number | null;
  players: TeamPlayer[];
};

export type ActivityType =
  | "transfer"
  | "points"
  | "lineup"
  | "rank"
  | "league_joined"
  | "league_created";

export type ActivityItem = {
  id: string;
  type: ActivityType;
  title: string;
  detail: string;
  timestamp: string;
  leagueName?: string;
};

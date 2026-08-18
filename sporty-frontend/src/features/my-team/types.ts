import type { Sport } from "./components/PlayerCard";

export type LeagueOption = {
  id: string;
  label: string;
  name: string;
  teamName: string | null;
};

export type MyTeamPlayerView = {
  id: string;
  name: string;
  sport: Sport;
  position: string;
  realTeam: string;
  photoUrl?: string | null;
  realTeamLogoUrl?: string | null;
  nationality?: string | null;
  flagUrl?: string | null;
  cost: string;
  totalPoints: number;
  avgPoints: number;
  gameweekPoints: number;
  gameweekBreakdown?: import("@/types/player").TScoreEvent[] | null;
  isStarter: boolean;
  isCaptain: boolean;
  isViceCaptain: boolean;
};

export type MyTeamLeagueView = {
  leagueId: string;
  leagueName: string;
  sports: Sport[];
  players: MyTeamPlayerView[];
  teamName: string;
  // True once we have real starter/bench data from the lineup endpoint. When
  // false the squad is shown as one group (roster-only / no lineup set yet).
  hasLineupSplit: boolean;
};

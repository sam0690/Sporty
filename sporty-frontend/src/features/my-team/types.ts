import type { Sport } from "@/components/dashboard/my-team/components/PlayerCard";

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
  cost: string;
  totalPoints: number;
  avgPoints: number;
};

export type MyTeamLeagueView = {
  leagueId: string;
  leagueName: string;
  sports: Sport[];
  players: MyTeamPlayerView[];
  teamName: string;
};

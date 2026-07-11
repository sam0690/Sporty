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
  cost: string;
  totalPoints: number;
  avgPoints: number;
  gameweekPoints: number;
};

export type MyTeamLeagueView = {
  leagueId: string;
  leagueName: string;
  sports: Sport[];
  players: MyTeamPlayerView[];
  teamName: string;
};

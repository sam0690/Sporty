import type { Sport } from "@/components/dashboard/my-team/components/PlayerCard";
import type { TFantasyTeam, TLeague, TTeamPlayer } from "@/types/league";
import { getLeagueDisplayName } from "@/hooks/my-team/useMyTeam";
import type { LeagueOption, MyTeamLeagueView, MyTeamPlayerView } from "./types";

export const normalizeSport = (sportName?: string): Sport => {
  const normalized = sportName?.trim().toLowerCase();

  if (
    normalized === "football" ||
    normalized === "basketball" ||
    normalized === "cricket"
  ) {
    return normalized;
  }

  return "football";
};

export const mapLeagueOptions = (leagues: TLeague[]): LeagueOption[] => {
  return leagues.map((league) => ({
    id: league.id,
    label: getLeagueDisplayName(league),
    name: league.name,
    teamName: league.my_team?.name ?? null,
  }));
};

export const mapTeamLeagueView = (
  activeLeague: LeagueOption | null,
  teamData: TFantasyTeam | null,
): MyTeamLeagueView | null => {
  if (!activeLeague || !teamData) {
    return null;
  }

  const rows = (teamData.team_players ??
    teamData.players ??
    []) as TTeamPlayer[];
  const players: MyTeamPlayerView[] = rows.map((teamPlayer) => ({
    id: teamPlayer.player.id,
    name: teamPlayer.player.name,
    sport: normalizeSport(teamPlayer.player.sport?.name),
    position: teamPlayer.player.position,
    realTeam: teamPlayer.player.real_team,
    cost: teamPlayer.player.cost,
    totalPoints: Number(teamPlayer.total_points ?? 0),
    avgPoints: Number(teamPlayer.avg_points ?? 0),
    gameweekPoints: Number(teamPlayer.gameweek_points ?? 0),
  }));

  const sports = Array.from(
    new Set(players.map((player) => player.sport)),
  ) as Sport[];

  return {
    leagueId: activeLeague.id,
    leagueName: activeLeague.name,
    sports,
    teamName: teamData.name,
    players,
  };
};

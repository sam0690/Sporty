import type { Sport } from "./components/PlayerCard";
import type {
  TFantasyTeam,
  TLeague,
  TLineupResponse,
  TTeamPlayer,
} from "@/types/league";
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
  lineup: TLineupResponse | null,
): MyTeamLeagueView | null => {
  if (!activeLeague || !teamData) {
    return null;
  }

  // Starter/captain flags come from the lineup endpoint keyed by player id.
  // When the lineup call is unavailable (season over, none set) we fall back
  // to showing the squad as one group — no XI/bench split, no armband.
  const starters = new Map(
    (lineup?.starting_lineup ?? []).map((entry) => [entry.player_id, entry]),
  );
  const hasLineupSplit = starters.size > 0;

  const rows = (teamData.team_players ??
    teamData.players ??
    []) as TTeamPlayer[];
  const players: MyTeamPlayerView[] = rows.map((teamPlayer) => {
    const entry = starters.get(teamPlayer.player.id);
    return {
      id: teamPlayer.player.id,
      name: teamPlayer.player.name,
      sport: normalizeSport(teamPlayer.player.sport?.name),
      position: teamPlayer.player.position,
      realTeam: teamPlayer.player.real_team,
      photoUrl: teamPlayer.player.photo_url,
      realTeamLogoUrl: teamPlayer.player.real_team_logo_url,
      cost: teamPlayer.player.cost,
      totalPoints: Number(teamPlayer.total_points ?? 0),
      avgPoints: Number(teamPlayer.avg_points ?? 0),
      gameweekPoints: Number(teamPlayer.gameweek_points ?? 0),
      // No split → treat every player as a starter so the single group renders.
      isStarter: hasLineupSplit ? Boolean(entry) : true,
      isCaptain: Boolean(entry?.is_captain),
      isViceCaptain: Boolean(entry?.is_vice_captain),
    };
  });

  const sports = Array.from(
    new Set(players.map((player) => player.sport)),
  ) as Sport[];

  return {
    leagueId: activeLeague.id,
    leagueName: activeLeague.name,
    sports,
    teamName: teamData.name,
    players,
    hasLineupSplit,
  };
};

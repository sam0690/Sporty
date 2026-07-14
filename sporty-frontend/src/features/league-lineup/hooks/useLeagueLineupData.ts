"use client";

import { useMemo } from "react";
import { useLineup } from "@/hooks/leagues/useLeagues";
import {
  normalizeSport,
  type SportKind,
} from "@/lib/formation/sportRegistry";

export type LineupPlayerCardModel = {
  id: string;
  playerId: string;
  name: string;
  position: string;
  realTeam: string;
  photoUrl?: string | null;
  realTeamLogoUrl?: string | null;
  cost: string;
  team?: string;
  sport: SportKind;
  sportName: string;
  sportDisplayName: string;
  isStarter: boolean;
  isCaptain: boolean;
  isViceCaptain: boolean;
};

function groupPlayersBySport(players: LineupPlayerCardModel[]) {
  return players.reduce<Record<string, LineupPlayerCardModel[]>>(
    (acc, player) => {
      if (!acc[player.sportDisplayName]) {
        acc[player.sportDisplayName] = [];
      }

      acc[player.sportDisplayName].push(player);
      return acc;
    },
    {},
  );
}

export function useLeagueLineupData(leagueId: string) {
  const lineupQuery = useLineup(leagueId);

  const players = useMemo<LineupPlayerCardModel[]>(() => {
    const entries = lineupQuery.data?.starting_lineup ?? [];
    const squadPlayers = lineupQuery.data?.squad_players ?? [];
    const starterIds = new Set(entries.map((entry) => entry.player_id));
    const flagsByPlayerId = entries.reduce<
      Record<string, { isCaptain: boolean; isViceCaptain: boolean }>
    >((acc, entry) => {
      acc[entry.player_id] = {
        isCaptain: entry.is_captain,
        isViceCaptain: entry.is_vice_captain,
      };
      return acc;
    }, {});

    return squadPlayers.map((row) => {
      const player = row.player;
      const flags = flagsByPlayerId[player.id] ?? {
        isCaptain: false,
        isViceCaptain: false,
      };

      return {
        id: player.id,
        playerId: player.id,
        name: player.name,
        position: player.position,
        realTeam: player.real_team,
        photoUrl: player.photo_url,
        realTeamLogoUrl: player.real_team_logo_url,
        cost: player.cost,
        team: player.real_team,
        sport: normalizeSport(player.sport.name),
        sportName: player.sport.name,
        sportDisplayName: player.sport.display_name,
        isStarter: starterIds.has(player.id),
        isCaptain: flags.isCaptain,
        isViceCaptain: flags.isViceCaptain,
      };
    });
  }, [lineupQuery.data]);

  const starters = useMemo(
    () => players.filter((player) => player.isStarter),
    [players],
  );

  const bench = useMemo(
    () => players.filter((player) => !player.isStarter),
    [players],
  );

  const groupedBySport = useMemo(() => {
    return groupPlayersBySport(players);
  }, [players]);

  const startersGroupedBySport = useMemo(
    () => groupPlayersBySport(starters),
    [starters],
  );

  const benchGroupedBySport = useMemo(
    () => groupPlayersBySport(bench),
    [bench],
  );

  return {
    ...lineupQuery,
    players,
    starters,
    bench,
    groupedBySport,
    startersGroupedBySport,
    benchGroupedBySport,
    isEmpty: players.length === 0,
  };
}

import { keepPreviousData } from "@tanstack/react-query";
import { useApiQuery } from "../api/useApiQuery";
import { PlayerService } from "@/services/PlayerService";
import type { TPlayerFilter, TPlayerListResponse } from "@/types";

type LeagueSportEntry = { sport?: { name?: string | null } | null };

const SUPPORTED_TRANSFER_POOL_SPORTS = new Set(["football", "basketball"]);

export const usePlayers = (filters: TPlayerFilter = {}) => {
  return useApiQuery<TPlayerListResponse>(
    ["players", "list", JSON.stringify(filters)],
    () => PlayerService.getPlayers(filters),
    {
      placeholderData: keepPreviousData,
    },
  );
};

export const useTransferPoolPlayers = (
  leagueId: string,
  leagueSports: LeagueSportEntry[] | undefined,
  playerFilters: TPlayerFilter = {},
  page = 1,
  pageSize = 20,
) => {
  const normalizedSports = (leagueSports ?? [])
    .map((entry) => entry?.sport?.name?.trim().toLowerCase())
    .filter(
      (name): name is string =>
        typeof name === "string" && SUPPORTED_TRANSFER_POOL_SPORTS.has(name),
    );

  const uniqueSports = Array.from(new Set(normalizedSports));
  const isMultiSportLeague = uniqueSports.length > 1;
  const primarySport = uniqueSports[0];

  const requestFilters: TPlayerFilter = {
    league_id: leagueId || undefined,
    page,
    page_size: pageSize,
    ...playerFilters,
    ...(!isMultiSportLeague && primarySport
      ? { sport_name: primarySport }
      : {}),
  };

  return usePlayers(requestFilters);
};

export const usePlayer = (id: string) => {
  return useApiQuery(
    ["players", "detail", id],
    () => PlayerService.getPlayer(id),
    {
      enabled: !!id,
    },
  );
};

export const usePlayerStats = (id: string, windowId: string) => {
  return useApiQuery(
    ["players", id, "stats", windowId],
    () => PlayerService.getPlayerStats(id, windowId),
    {
      enabled: !!id && !!windowId,
    },
  );
};

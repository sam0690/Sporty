"use client";

import { useCallback, useMemo, useState } from "react";
import { usePlayers } from "@/hooks/players/usePlayers";
import { usePlayerFilters } from "@/hooks/players/usePlayerFilters";
import type { MarketPlayer } from "../components/PlayerCard";

const sportIconByName: Record<string, string> = {
  football: "⚽",
  basketball: "🏀",
};

export const PLAYER_PAGE_SIZE = 20;

export function toMarketPlayer(p: {
  id: string;
  display_name: string;
  sport: { name: string };
  position: string;
  real_team: string;
  photo_url?: string | null;
  real_team_logo_url?: string | null;
  nationality?: string | null;
  flag_url?: string | null;
  current_cost: string | number;
}): MarketPlayer {
  return {
    id: p.id,
    name: p.display_name,
    sport: p.sport.name as "football" | "basketball",
    icon: sportIconByName[p.sport.name] ?? "🏅",
    position: p.position,
    realTeam: p.real_team,
    photoUrl: p.photo_url,
    realTeamLogoUrl: p.real_team_logo_url,
    nationality: p.nationality,
    flagUrl: p.flag_url,
    price: Number(p.current_cost),
    projected: 0,
  };
}

/**
 * Player-market browsing state shared by the draft room and the budget team
 * builder: search/position/sport/club/cost filters, server-side pagination, and
 * the MarketPlayer mapping. `fixedSportName` pins the market to one sport for
 * single-sport budget leagues; draft and multisport leagues browse all.
 */
export function usePlayerMarket(leagueId: string, fixedSportName?: string) {
  const [playersPage, setPlayersPage] = useState(1);
  const {
    searchQuery,
    setSearchQuery,
    selectedPosition,
    setSelectedPosition,
    selectedSport,
    setSelectedSport,
    selectedClub,
    setSelectedClub,
    minCostInput,
    setMinCostInput,
    maxCostInput,
    setMaxCostInput,
    filters: playerFilters,
  } = usePlayerFilters(fixedSportName);

  const { data: playersData, isLoading: playersLoading } = usePlayers({
    league_id: leagueId || undefined,
    page: playersPage,
    page_size: PLAYER_PAGE_SIZE,
    ...playerFilters,
    ...(fixedSportName ? { sport_name: fixedSportName } : {}),
  });

  const marketPlayers: MarketPlayer[] = useMemo(
    () => (playersData?.items ?? []).map(toMarketPlayer),
    [playersData],
  );

  const playersPageSize = playersData?.page_size ?? PLAYER_PAGE_SIZE;
  const playersTotal = playersData?.total ?? 0;
  const playersCurrentPage = playersData?.page ?? playersPage;
  const playersTotalPages = Math.max(
    1,
    Math.ceil(playersTotal / Math.max(playersPageSize, 1)),
  );
  const isPlayersPageLoading =
    playersLoading ||
    (playersData?.page !== undefined && playersData.page !== playersPage);

  // Every filter change resets to page 1 — a filtered result set has its own
  // pagination.
  const handleSearchQueryChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      setPlayersPage(1);
    },
    [setSearchQuery],
  );
  const handlePositionChange = useCallback(
    (position: string) => {
      setSelectedPosition(position);
      setPlayersPage(1);
    },
    [setSelectedPosition],
  );
  const handleSportChange = useCallback(
    (sport: string) => {
      setSelectedSport(sport);
      setPlayersPage(1);
    },
    [setSelectedSport],
  );
  const handleClubChange = useCallback(
    (club: string) => {
      setSelectedClub(club);
      setPlayersPage(1);
    },
    [setSelectedClub],
  );
  const handleMinCostChange = useCallback(
    (value: string) => {
      setMinCostInput(value);
      setPlayersPage(1);
    },
    [setMinCostInput],
  );
  const handleMaxCostChange = useCallback(
    (value: string) => {
      setMaxCostInput(value);
      setPlayersPage(1);
    },
    [setMaxCostInput],
  );

  const handlePreviousPlayersPage = useCallback(() => {
    setPlayersPage((current) => Math.max(1, current - 1));
  }, []);
  const handleNextPlayersPage = useCallback(() => {
    if (playersData?.has_next) {
      setPlayersPage((current) => current + 1);
    }
  }, [playersData?.has_next]);

  return {
    playersData,
    playersLoading,
    marketPlayers,
    playersPage,
    setPlayersPage,
    playersPageSize,
    playersTotal,
    playersCurrentPage,
    playersTotalPages,
    isPlayersPageLoading,
    searchQuery,
    selectedPosition,
    selectedSport,
    selectedClub,
    minCostInput,
    maxCostInput,
    handleSearchQueryChange,
    handlePositionChange,
    handleSportChange,
    handleClubChange,
    handleMinCostChange,
    handleMaxCostChange,
    handlePreviousPlayersPage,
    handleNextPlayersPage,
  } as const;
}

export type PlayerMarketState = ReturnType<typeof usePlayerMarket>;

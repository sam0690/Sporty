"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/dashboard/create-team/components/EmptyState";
import {
  PlayerCard,
  type MarketPlayer,
} from "@/components/dashboard/create-team/components/PlayerCard";

type PlayerMarketProps = {
  players: MarketPlayer[];
  onAddPlayer: (player: MarketPlayer) => void;
  onRemovePlayer: (playerId: string) => void;
  selectedPlayerIds: string[];
  sport: "football" | "basketball" | "cricket" | "multisport";
  remainingBudget: number;
  searchQuery: string;
  selectedPosition: string;
  selectedSport: string;
  selectedCostFilter: "All" | "Under 5" | "5 - 8" | "Above 8";
  onSearchQueryChange: (value: string) => void;
  onPositionChange: (value: string) => void;
  onSportChange: (value: string) => void;
  onCostFilterChange: (value: "All" | "Under 5" | "5 - 8" | "Above 8") => void;
  canAddPlayers?: boolean;
  addDisabledReason?: string;
  currentPage: number;
  totalPages: number;
  totalPlayers: number;
  hasNext: boolean;
  isLoadingPage?: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
};

export function PlayerMarket({
  players,
  onAddPlayer,
  onRemovePlayer,
  selectedPlayerIds,
  sport,
  remainingBudget,
  searchQuery,
  selectedPosition,
  selectedSport,
  selectedCostFilter,
  onSearchQueryChange,
  onPositionChange,
  onSportChange,
  onCostFilterChange,
  canAddPlayers = true,
  addDisabledReason = "Action unavailable",
  currentPage,
  totalPages,
  totalPlayers,
  hasNext,
  isLoadingPage = false,
  onPreviousPage,
  onNextPage,
}: PlayerMarketProps) {
  const positions = useMemo(
    () => [
      "All",
      ...Array.from(new Set(players.map((player) => player.position))),
    ],
    [players],
  );

  const sports = useMemo(
    () => [
      "All",
      ...Array.from(new Set(players.map((player) => player.sport))),
    ],
    [players],
  );

  const filteredPlayers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return players.filter((player) => {
      const searchOk =
        query.length === 0 || player.name.toLowerCase().includes(query);
      const positionOk =
        selectedPosition === "All" || player.position === selectedPosition;
      const sportOk = selectedSport === "All" || player.sport === selectedSport;
      return searchOk && positionOk && sportOk;
    });
  }, [players, searchQuery, selectedPosition, selectedSport]);

  return (
    <section className="space-y-4 rounded-lg bg-[#F4F4F9] p-4 shadow-card">
      <h2 className="text-lg font-semibold text-black">Player Market</h2>

      <input
        value={searchQuery}
        onChange={(event) => onSearchQueryChange(event.target.value)}
        placeholder="Search by player name..."
        className="w-full rounded-lg border border-border px-4 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-primary"
      />

      <div className="flex flex-wrap gap-2">
        {positions.map((position) => {
          const active = position === selectedPosition;
          return (
            <button
              key={position}
              type="button"
              onClick={() => onPositionChange(position)}
              className={`rounded-md px-3 py-1.5 text-xs ${active ? "bg-primary/100 text-white" : "bg-white text-secondary hover:bg-white-200"}`}
            >
              {position}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {(["All", "Under 5", "5 - 8", "Above 8"] as const).map((costBand) => {
          const active = costBand === selectedCostFilter;
          return (
            <button
              key={costBand}
              type="button"
              onClick={() => onCostFilterChange(costBand)}
              className={`rounded-md px-3 py-1.5 text-xs ${active ? "bg-primary/100 text-white" : "bg-white text-secondary hover:bg-white-200"}`}
            >
              {costBand === "All" ? "All Costs" : `$${costBand}M`}
            </button>
          );
        })}
      </div>

      {sport === "multisport" ? (
        <div className="flex flex-wrap gap-2">
          {sports.map((sportOption) => {
            const active = sportOption === selectedSport;
            return (
              <button
                key={sportOption}
                type="button"
                onClick={() => onSportChange(sportOption)}
                className={`rounded-md px-3 py-1.5 text-xs capitalize ${active ? "bg-primary/100 text-white" : "bg-white text-secondary hover:bg-white-200"}`}
              >
                {sportOption}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-white/80 px-4 py-3 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-sm text-secondary">
          <span className="font-semibold text-black">Page {currentPage}</span>
          <span>/ {Math.max(totalPages, 1)}</span>
          <span className="hidden sm:inline">•</span>
          <span>{totalPlayers} players total</span>
          {isLoadingPage ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading next page
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPreviousPage}
            disabled={currentPage <= 1 || isLoadingPage}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-[#F4F4F9] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <button
            type="button"
            onClick={onNextPage}
            disabled={!hasNext || isLoadingPage}
            className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="max-h-[60vh] space-y-3 overflow-y-auto p-1">
        {isLoadingPage && filteredPlayers.length === 0 ? (
          <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-border bg-white/70 text-sm text-secondary">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />
            Loading players...
          </div>
        ) : filteredPlayers.length === 0 ? (
          <EmptyState message="No players found for the selected filters." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {filteredPlayers.map((player) => {
              const isSelected = selectedPlayerIds.includes(player.id);
              const canAfford = isSelected || remainingBudget >= player.price;

              return (
                <PlayerCard
                  key={player.id}
                  player={player}
                  onAdd={onAddPlayer}
                  onRemove={onRemovePlayer}
                  isSelected={isSelected}
                  canAfford={canAfford}
                  showSportIcon={sport === "multisport"}
                  canAddPlayer={canAddPlayers}
                  addDisabledReason={addDisabledReason}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

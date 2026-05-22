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
    <section className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.18)] backdrop-blur-xl">
      <h2 className="text-lg font-semibold text-foreground">Player Market</h2>

      <input
        value={searchQuery}
        onChange={(event) => onSearchQueryChange(event.target.value)}
        placeholder="Search by player name..."
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-foreground outline-none focus:border-accent-primary/30 focus:ring-2 focus:ring-accent-primary/20"
      />

      <div className="flex flex-wrap gap-2">
        {positions.map((position) => {
          const active = position === selectedPosition;
          return (
            <button
              key={position}
              type="button"
              onClick={() => onPositionChange(position)}
              className={`rounded-full px-3 py-1.5 text-xs ${active ? "bg-accent-primary/10 text-accent-primary" : "bg-white/5 text-slate-300 hover:bg-white/8"}`}
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
              className={`rounded-full px-3 py-1.5 text-xs ${active ? "bg-accent-primary/10 text-accent-primary" : "bg-white/5 text-slate-300 hover:bg-white/8"}`}
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
                className={`rounded-full px-3 py-1.5 text-xs capitalize ${active ? "bg-accent-primary/10 text-accent-primary" : "bg-white/5 text-slate-300 hover:bg-white/8"}`}
              >
                {sportOption}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
          <span className="font-semibold text-foreground">
            Page {currentPage}
          </span>
          <span>/ {Math.max(totalPages, 1)}</span>
          <span className="hidden sm:inline">•</span>
          <span>{totalPlayers} players total</span>
          {isLoadingPage ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-primary/10 px-2.5 py-1 text-xs font-medium text-accent-primary">
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
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <button
            type="button"
            onClick={onNextPage}
            disabled={!hasNext || isLoadingPage}
            className="inline-flex items-center gap-1 rounded-full bg-linear-to-r from-accent-primary to-accent-secondary px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="max-h-[60vh] space-y-3 overflow-y-auto p-1">
        {isLoadingPage && filteredPlayers.length === 0 ? (
          <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/5 text-sm text-slate-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-accent-primary" />
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

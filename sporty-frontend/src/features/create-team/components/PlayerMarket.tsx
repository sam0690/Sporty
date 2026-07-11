"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight, Loader2, Search, SearchX } from "lucide-react";
import { EmptyState, Select } from "@/components/ui";
import { PlayerCard, type MarketPlayer } from "./PlayerCard";

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
  minCost: string;
  maxCost: string;
  onSearchQueryChange: (value: string) => void;
  onPositionChange: (value: string) => void;
  onSportChange: (value: string) => void;
  onMinCostChange: (value: string) => void;
  onMaxCostChange: (value: string) => void;
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
  minCost,
  maxCost,
  onSearchQueryChange,
  onPositionChange,
  onSportChange,
  onMinCostChange,
  onMaxCostChange,
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

  return (
    <section className="space-y-4 card-surface p-4">
      <p className="section-label">Player Market</p>

      <label className="relative block">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-3" />
        <input
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Search by player name..."
          className="w-full rounded-[3px] border border-white/8 bg-surface-2 px-4 py-2 pl-11 text-sm text-fg-1 outline-none transition-colors focus:border-accent"
        />
      </label>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1.5">
          <span className="section-label">Position</span>
          <Select
            value={selectedPosition}
            onChange={onPositionChange}
            className="w-full"
            options={positions.map((position) => ({
              value: position,
              label: position,
            }))}
          />
        </label>

        <label className="space-y-1.5">
          <span className="section-label">Min cost</span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={minCost}
            onChange={(event) => onMinCostChange(event.target.value)}
            placeholder="0"
            className="w-full rounded-[3px] border border-white/8 bg-surface-2 px-3 py-2 text-sm text-fg-1 outline-none transition-colors focus:border-accent"
          />
        </label>

        <label className="space-y-1.5">
          <span className="section-label">Max cost</span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={maxCost}
            onChange={(event) => onMaxCostChange(event.target.value)}
            placeholder="Any"
            className="w-full rounded-[3px] border border-white/8 bg-surface-2 px-3 py-2 text-sm text-fg-1 outline-none transition-colors focus:border-accent"
          />
        </label>
      </div>

      {sport === "multisport" ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="section-label">Sport</span>
          {sports.map((sportOption) => {
            const active = sportOption === selectedSport;
            return (
              <button
                key={sportOption}
                type="button"
                onClick={() => onSportChange(sportOption)}
                className={`rounded-[3px] border px-3 py-1.5 font-sans text-xs font-700 uppercase tracking-[1px] capitalize transition-colors ${
                  active
                    ? "border-accent/30 bg-accent/10 text-accent"
                    : "border-white/8 bg-surface-3 text-fg-2 hover:text-fg-1"
                }`}
              >
                {sportOption}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-[3px] border border-white/8 bg-surface-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 font-sans text-xs font-700 uppercase tracking-[1px] text-fg-3">
          <span className="text-fg-1">Page {currentPage}</span>
          <span>/ {Math.max(totalPages, 1)}</span>
          <span className="hidden sm:inline">·</span>
          <span>{totalPlayers} players</span>
          {isLoadingPage ? (
            <span className="inline-flex items-center gap-1 rounded-[3px] bg-accent/10 px-2.5 py-1 text-accent">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPreviousPage}
            disabled={currentPage <= 1 || isLoadingPage}
            className="inline-flex items-center gap-1 rounded-[3px] border border-white/8 bg-surface-3 px-3.5 py-1.5 font-sans text-xs font-700 uppercase tracking-[1px] text-fg-2 transition-colors hover:text-fg-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </button>
          <button
            type="button"
            onClick={onNextPage}
            disabled={!hasNext || isLoadingPage}
            className="inline-flex items-center gap-1 rounded-[3px] bg-accent px-3.5 py-1.5 font-sans text-xs font-700 uppercase tracking-[1px] text-black transition-colors hover:bg-accent-bright disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-fg-3"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="max-h-[60vh] space-y-3 overflow-y-auto p-1">
        {isLoadingPage && players.length === 0 ? (
          <div className="flex min-h-40 items-center justify-center rounded-[3px] border border-dashed border-white/8 bg-surface-2 text-sm text-fg-3">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-accent" />
            Loading players...
          </div>
        ) : players.length === 0 ? (
          <EmptyState icon={SearchX} title="No players found for the selected filters." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {players.map((player) => {
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

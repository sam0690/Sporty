"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react";
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
    <section className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.18)] backdrop-blur-xl">
      <h2 className="text-lg font-semibold text-foreground">Player Market</h2>

      <label className="relative block">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Search by player name..."
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 pl-11 text-sm text-foreground outline-none focus:border-accent-primary/30 focus:ring-2 focus:ring-accent-primary/20"
        />
      </label>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1 text-xs font-medium uppercase tracking-wide text-slate-400">
          <span>Position</span>
          <select
            value={selectedPosition}
            onChange={(event) => onPositionChange(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-primary/30 focus:ring-2 focus:ring-accent-primary/20"
          >
            {positions.map((position) => (
              <option key={position} value={position}>
                {position}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-xs font-medium uppercase tracking-wide text-slate-400">
          <span>Min cost</span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={minCost}
            onChange={(event) => onMinCostChange(event.target.value)}
            placeholder="0"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-primary/30 focus:ring-2 focus:ring-accent-primary/20"
          />
        </label>

        <label className="space-y-1 text-xs font-medium uppercase tracking-wide text-slate-400">
          <span>Max cost</span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={maxCost}
            onChange={(event) => onMaxCostChange(event.target.value)}
            placeholder="Any"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-primary/30 focus:ring-2 focus:ring-accent-primary/20"
          />
        </label>
      </div>

      {sport === "multisport" ? (
        <div className="flex flex-wrap gap-2 text-xs text-slate-400">
          <span className="uppercase tracking-wider text-slate-500">Sport</span>
          {sports.map((sportOption) => {
            const active = sportOption === selectedSport;
            return (
              <button
                key={sportOption}
                type="button"
                onClick={() => onSportChange(sportOption)}
                className={`rounded-full px-3 py-1.5 capitalize ${active ? "bg-accent-primary/10 text-accent-primary" : "bg-white/5 text-slate-300 hover:bg-white/8"}`}
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
        {isLoadingPage && players.length === 0 ? (
          <div className="flex min-h-40 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/5 text-sm text-slate-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-accent-primary" />
            Loading players...
          </div>
        ) : players.length === 0 ? (
          <EmptyState message="No players found for the selected filters." />
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

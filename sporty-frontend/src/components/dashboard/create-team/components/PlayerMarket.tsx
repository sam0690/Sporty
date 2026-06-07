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
    <section className="space-y-4 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4 ">
      <h2 className="text-lg font-600 text-[#f0f0f0]">Player Market</h2>

      <label className="relative block">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#555560]" />
        <input
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Search by player name..."
          className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-2 pl-11 text-sm text-[#f0f0f0] outline-none focus:border-[rgba(232,251,37,0.3)] focus:border-[#e8fb25]"
        />
      </label>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1 text-xs uppercase tracking-wide text-[#555560]">
          <span>Position</span>
          <select
            value={selectedPosition}
            onChange={(event) => onPositionChange(event.target.value)}
            className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-3 py-2 text-sm text-[#f0f0f0] outline-none focus:border-[rgba(232,251,37,0.3)] focus:border-[#e8fb25]"
          >
            {positions.map((position) => (
              <option key={position} value={position}>
                {position}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-xs uppercase tracking-wide text-[#555560]">
          <span>Min cost</span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={minCost}
            onChange={(event) => onMinCostChange(event.target.value)}
            placeholder="0"
            className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-3 py-2 text-sm text-[#f0f0f0] outline-none focus:border-[rgba(232,251,37,0.3)] focus:border-[#e8fb25]"
          />
        </label>

        <label className="space-y-1 text-xs uppercase tracking-wide text-[#555560]">
          <span>Max cost</span>
          <input
            type="number"
            min="0"
            step="0.1"
            value={maxCost}
            onChange={(event) => onMaxCostChange(event.target.value)}
            placeholder="Any"
            className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-3 py-2 text-sm text-[#f0f0f0] outline-none focus:border-[rgba(232,251,37,0.3)] focus:border-[#e8fb25]"
          />
        </label>
      </div>

      {sport === "multisport" ? (
        <div className="flex flex-wrap gap-2 text-xs text-[#555560]">
          <span className="uppercase tracking-wider text-[#555560]">Sport</span>
          {sports.map((sportOption) => {
            const active = sportOption === selectedSport;
            return (
              <button
                key={sportOption}
                type="button"
                onClick={() => onSportChange(sportOption)}
                className={`rounded-[3px] px-3 py-1.5 capitalize ${active ? "bg-[rgba(232,251,37,0.1)] text-[#e8fb25]" : "bg-[#1d1d26] text-[#f0f0f0] hover:bg-[#1d1d26]"}`}
              >
                {sportOption}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-sm text-[#555560]">
          <span className="font-600 text-[#f0f0f0]">
            Page {currentPage}
          </span>
          <span>/ {Math.max(totalPages, 1)}</span>
          <span className="hidden sm:inline">•</span>
          <span>{totalPlayers} players total</span>
          {isLoadingPage ? (
            <span className="inline-flex items-center gap-1 rounded-[3px] bg-[rgba(232,251,37,0.1)] px-2.5 py-1 text-xs text-[#e8fb25]">
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
            className="inline-flex items-center gap-1 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-2 text-sm text-[#f0f0f0] transition-colors hover:bg-[#1d1d26] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <button
            type="button"
            onClick={onNextPage}
            disabled={!hasNext || isLoadingPage}
            className="inline-flex items-center gap-1 rounded-[3px] bg-linear-to-r [#e8fb25] px-4 py-2 text-sm font-600 text-slate-950 transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="max-h-[60vh] space-y-3 overflow-y-auto p-1">
        {isLoadingPage && players.length === 0 ? (
          <div className="flex min-h-40 items-center justify-center rounded-[3px] border border-dashed border-[rgba(255,255,255,0.08)] bg-[#1d1d26] text-sm text-[#555560]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin text-[#e8fb25]" />
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

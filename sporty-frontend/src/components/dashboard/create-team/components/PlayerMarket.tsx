"use client";

import { useMemo } from "react";
import { EmptyState } from "@/components/dashboard/create-team/components/EmptyState";
import { PlayerCard, type MarketPlayer } from "@/components/dashboard/create-team/components/PlayerCard";

type PlayerMarketProps = {
  players: MarketPlayer[];
  onAddPlayer: (player: MarketPlayer) => void;
  onRemovePlayer: (playerId: number) => void;
  selectedPlayerIds: number[];
  sport: "football" | "basketball" | "cricket" | "multisport";
  remainingBudget: number;
  searchQuery: string;
  selectedPosition: string;
  selectedSport: string;
  onSearchQueryChange: (value: string) => void;
  onPositionChange: (value: string) => void;
  onSportChange: (value: string) => void;
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
  onSearchQueryChange,
  onPositionChange,
  onSportChange,
}: PlayerMarketProps) {
  const positions = useMemo(() => {
    return ["All", ...Array.from(new Set(players.map((player) => player.position)))];
  }, [players]);

  const sports = useMemo(() => {
    return ["All", ...Array.from(new Set(players.map((player) => player.sport)))];
  }, [players]);

  const filteredPlayers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return players.filter((player) => {
      const searchOk = query.length === 0 || player.name.toLowerCase().includes(query);
      const positionOk = selectedPosition === "All" || player.position === selectedPosition;
      const sportOk = selectedSport === "All" || player.sport === selectedSport;
      return searchOk && positionOk && sportOk;
    });
  }, [players, searchQuery, selectedPosition, selectedSport]);

  return (
    <section className="space-y-4 rounded-lg bg-surface-100 p-4 shadow-card">
      <h2 className="text-lg font-semibold text-text-primary">Player Market</h2>

      <input
        value={searchQuery}
        onChange={(event) => onSearchQueryChange(event.target.value)}
        placeholder="Search by player name..."
        className="w-full rounded-lg border border-border px-4 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-primary-500"
      />

      <div className="flex flex-wrap gap-2">
        {positions.map((position) => {
          const active = position === selectedPosition;
          return (
            <button
              key={position}
              type="button"
              onClick={() => onPositionChange(position)}
              className={`rounded-md px-3 py-1.5 text-xs ${active ? "bg-primary-500 text-white" : "bg-white text-text-secondary hover:bg-surface-200"}`}
            >
              {position}
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
                className={`rounded-md px-3 py-1.5 text-xs capitalize ${active ? "bg-primary-500 text-white" : "bg-white text-text-secondary hover:bg-surface-200"}`}
              >
                {sportOption}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="max-h-[60vh] space-y-3 overflow-y-auto p-1">
        {filteredPlayers.length === 0 ? (
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
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

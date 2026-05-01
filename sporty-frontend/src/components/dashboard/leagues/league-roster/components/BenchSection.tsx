"use client";

import type { Player } from "@/components/dashboard/leagues/league-roster/components/PlayerCard";

type SportCount = {
  football: number;
  basketball: number;
  cricket: number;
};

type BenchSectionProps = {
  benchPlayers: Player[];
  onMoveToPitch: (playerId: number) => void;
  activeCountsPerSport: SportCount;
  isMultiSport: boolean;
  pitchIsFull: boolean;
};

const sportIcons = {
  football: "⚽",
  basketball: "🏀",
  cricket: "🏏",
};

export function BenchSection({
  benchPlayers,
  onMoveToPitch,
  activeCountsPerSport,
  isMultiSport,
  pitchIsFull,
}: BenchSectionProps) {
  return (
    <section className="mt-8 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-black">Bench ({benchPlayers.length})</h3>
        <span className="text-xs text-secondary">Start players to fill pitch spots</span>
      </div>

      {benchPlayers.length === 0 ? (
        <div className="rounded-md border border-accent/20 bg-white p-4 text-sm text-secondary">
          No bench players available for the current filters.
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max gap-3 md:grid md:min-w-0 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {benchPlayers.map((player) => {
              const sportAtLimit =
                isMultiSport &&
                ((player.sport === "football" && activeCountsPerSport.football >= 3) ||
                  (player.sport === "basketball" && activeCountsPerSport.basketball >= 3) ||
                  (player.sport === "cricket" && activeCountsPerSport.cricket >= 3));

              const disabled = pitchIsFull || sportAtLimit;
              const disabledReason = pitchIsFull
                ? "Pitch is full. Move someone to bench first."
                : sportAtLimit
                  ? `${player.sport.charAt(0).toUpperCase() + player.sport.slice(1)} already has 3 players on pitch`
                  : "";

              return (
                <article key={player.id} className="w-64 rounded-md border border-accent/20 bg-white p-3 md:w-auto">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-black">{player.name}</p>
                      <p className="text-xs text-secondary">{sportIcons[player.sport]} {player.position}</p>
                    </div>
                    <p className="text-xs font-medium text-black">{player.totalPoints} pts</p>
                  </div>

                  <div className="mt-3 flex items-center justify-end">
                    <button
                      type="button"
                      title={disabled ? disabledReason : "Move player to pitch"}
                      disabled={disabled}
                      onClick={() => onMoveToPitch(player.id)}
                      className="rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-accent/40 disabled:text-secondary"
                    >
                      Start
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

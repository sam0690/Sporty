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
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary">Bench ({benchPlayers.length})</h3>
        <span className="text-xs text-text-secondary">Start players to fill pitch spots</span>
      </div>

      {benchPlayers.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface-100 p-4 text-sm text-text-secondary">
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
                <article key={player.id} className="w-64 rounded-lg border border-border bg-surface-100 p-3 shadow-card md:w-auto">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-text-primary">{player.name}</p>
                      <p className="text-xs text-text-secondary">{player.position}</p>
                    </div>
                    <span className="text-base" aria-label={player.sport}>
                      {sportIcons[player.sport]}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-sm font-medium text-primary-600">{player.totalPoints} pts</p>
                    <button
                      type="button"
                      title={disabled ? disabledReason : "Move player to pitch"}
                      disabled={disabled}
                      onClick={() => onMoveToPitch(player.id)}
                      className="rounded-md bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600"
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

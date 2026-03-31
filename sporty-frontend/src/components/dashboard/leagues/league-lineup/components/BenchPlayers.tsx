"use client";

import { PlayerSlot, type Player } from "@/components/dashboard/leagues/league-lineup/components/PlayerSlot";

type BenchPlayersProps = {
  benchPlayers: Player[];
  onTogglePlayer: (playerId: number) => void;
  disabled?: boolean;
};

export function BenchPlayers({
  benchPlayers,
  onTogglePlayer,
  disabled = false,
}: BenchPlayersProps) {
  return (
    <section className="space-y-3 rounded-2xl border border-gray-100 bg-white p-5 [animation:fade-soft_0.2s_ease]">
      <h2 className="text-md font-medium text-gray-800">Bench ({benchPlayers.length})</h2>

      <div className="space-y-2">
        {benchPlayers.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-4 text-center text-sm text-gray-400">
            No bench players available
          </div>
        ) : (
          benchPlayers.map((player) => (
            <PlayerSlot
              key={player.id}
              player={player}
              isActive={false}
              onToggle={onTogglePlayer}
              variant="bench"
              disabled={disabled}
            />
          ))
        )}
      </div>
    </section>
  );
}

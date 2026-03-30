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
    <section className="space-y-3 rounded-lg bg-surface-100 p-4 shadow-card">
      <h2 className="text-lg font-semibold text-text-primary">Bench ({benchPlayers.length})</h2>

      <div className="space-y-3">
        {benchPlayers.length === 0 ? (
          <p className="text-sm text-text-secondary">No bench players available</p>
        ) : (
          benchPlayers.map((player) => (
            <PlayerSlot
              key={player.id}
              player={player}
              isActive={false}
              onToggle={onTogglePlayer}
              disabled={disabled}
            />
          ))
        )}
      </div>
    </section>
  );
}

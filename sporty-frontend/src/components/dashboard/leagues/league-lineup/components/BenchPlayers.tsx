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
    <section className="space-y-3 rounded-lg border border-accent/20 bg-white p-5 [animation:fade-soft_0.2s_ease]">
      <h2 className="text-md font-medium text-black">Bench ({benchPlayers.length})</h2>

      <div className="space-y-2">
        {benchPlayers.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-[#F4F4F9]/50 p-4 text-center text-sm text-secondary/60">
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

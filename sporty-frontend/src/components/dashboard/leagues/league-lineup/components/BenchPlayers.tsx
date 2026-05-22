"use client";

import {
  PlayerSlot,
  type Player,
} from "@/components/dashboard/leagues/league-lineup/components/PlayerSlot";

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
    <section className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl [animation:fade-soft_0.2s_ease]">
      <h2 className="text-md font-medium text-foreground">
        Bench ({benchPlayers.length})
      </h2>

      <div className="space-y-2">
        {benchPlayers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-center text-sm text-foreground/55">
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

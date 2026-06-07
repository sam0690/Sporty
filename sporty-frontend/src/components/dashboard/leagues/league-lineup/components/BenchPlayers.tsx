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
    <section className="space-y-3 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-5  [animation:fade-soft_0.2s_ease]">
      <h2 className="text-md text-[#f0f0f0]">
        Bench ({benchPlayers.length})
      </h2>

      <div className="space-y-2">
        {benchPlayers.length === 0 ? (
          <div className="rounded-[3px] border border-dashed border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4 text-center text-sm text-[#555560]">
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

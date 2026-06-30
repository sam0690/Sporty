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
    <section className="space-y-3 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-5 [animation:fade-soft_0.2s_ease]">
      <div className="flex items-baseline justify-between">
        <p className="section-label">Bench</p>
        <p className="font-bebas text-xl leading-none tracking-[1px] text-[#f0f0f0] tabular-nums">
          {benchPlayers.length}
        </p>
      </div>

      <div className="space-y-2">
        {benchPlayers.length === 0 ? (
          <div className="rounded-[3px] border border-dashed border-[rgba(255,255,255,0.08)] bg-[#0d0d12] p-4 text-center font-barlow-condensed text-sm font-700 uppercase tracking-[1px] text-[#555560]">
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

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
    <section className="space-y-3 rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] p-5">
      <div className="flex items-baseline justify-between">
        <p className="section-label">Bench</p>
        <p className="font-bebas text-xl leading-none tracking-[1px] text-[#0B1220] tabular-nums">
          {benchPlayers.length}
        </p>
      </div>

      <div className="space-y-2">
        {benchPlayers.length === 0 ? (
          <div className="rounded-[3px] border border-dashed border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] p-4 text-center font-barlow-condensed text-sm font-bold uppercase tracking-[1px] text-[#6B7280]">
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

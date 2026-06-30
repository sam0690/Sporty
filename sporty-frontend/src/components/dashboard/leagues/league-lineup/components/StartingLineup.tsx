"use client";

import { PositionGroup } from "@/components/dashboard/leagues/league-lineup/components/PositionGroup";
import type { Player } from "@/components/dashboard/leagues/league-lineup/components/PlayerSlot";

type PositionLimit = {
  max: number;
  current: number;
};

type StartingLineupProps = {
  activePlayers: Player[];
  allPlayers: Player[];
  onTogglePlayer: (playerId: number) => void;
  activePlayerIds: number[];
  positionLimits: Record<string, PositionLimit>;
  totalSlots?: number;
  disabled?: boolean;
};

export function StartingLineup({
  activePlayers,
  allPlayers,
  onTogglePlayer,
  activePlayerIds,
  positionLimits,
  totalSlots,
  disabled = false,
}: StartingLineupProps) {
  const positions = Object.keys(positionLimits);
  const maxStarters =
    totalSlots ??
    Object.values(positionLimits).reduce((sum, limit) => sum + limit.max, 0);

  return (
    <section className="space-y-4 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-5 animate-[fade-soft_0.2s_ease]">
      <div className="flex items-baseline justify-between">
        <p className="section-label">Starting Lineup</p>
        <p className="font-bebas text-xl leading-none tracking-[1px] text-[#f0f0f0] tabular-nums">
          {activePlayers.length}
          <span className="text-[#555560]">/{maxStarters}</span>
        </p>
      </div>

      {activePlayers.length === 0 ? (
        <div className="rounded-[3px] border border-dashed border-[rgba(255,255,255,0.08)] bg-[#0d0d12] p-4 text-center font-barlow-condensed text-sm font-700 uppercase tracking-[1px] text-[#555560]">
          No active players selected
        </div>
      ) : (
        <div className="space-y-5">
          {positions.map((position) => {
            const playersInPosition = allPlayers.filter(
              (player) =>
                player.position === position &&
                activePlayerIds.includes(player.id),
            );
            if (playersInPosition.length === 0) {
              return (
                <PositionGroup
                  key={position}
                  position={position}
                  players={[]}
                  onTogglePlayer={onTogglePlayer}
                  limits={positionLimits[position]}
                  disabled={disabled}
                />
              );
            }

            return (
              <PositionGroup
                key={position}
                position={position}
                players={playersInPosition}
                onTogglePlayer={onTogglePlayer}
                limits={positionLimits[position]}
                disabled={disabled}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

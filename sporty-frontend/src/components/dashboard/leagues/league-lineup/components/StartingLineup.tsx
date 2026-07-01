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
    <section className="space-y-4 rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] p-5">
      <div className="flex items-baseline justify-between">
        <p className="section-label">Starting Lineup</p>
        <p className="font-bebas text-xl leading-none tracking-[1px] text-[#0B1220] tabular-nums">
          {activePlayers.length}
          <span className="text-[#6B7280]">/{maxStarters}</span>
        </p>
      </div>

      {activePlayers.length === 0 ? (
        <div className="rounded-[3px] border border-dashed border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] p-4 text-center font-barlow-condensed text-sm font-bold uppercase tracking-[1px] text-[#6B7280]">
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

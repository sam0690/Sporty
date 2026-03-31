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
  const maxStarters = totalSlots ?? Object.values(positionLimits).reduce((sum, limit) => sum + limit.max, 0);

  return (
    <section className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5 [animation:fade-soft_0.2s_ease]">
      <h2 className="text-md font-medium text-gray-800">
        Starting Lineup ({activePlayers.length}/{maxStarters})
      </h2>

      {activePlayers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-4 text-center text-sm text-gray-400">
          No active players selected
        </div>
      ) : (
        <div className="space-y-5">
          {positions.map((position) => {
            const playersInPosition = allPlayers.filter(
              (player) => player.position === position && activePlayerIds.includes(player.id),
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

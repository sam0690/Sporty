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
  disabled?: boolean;
};

export function StartingLineup({
  activePlayers,
  allPlayers,
  onTogglePlayer,
  activePlayerIds,
  positionLimits,
  disabled = false,
}: StartingLineupProps) {
  const positions = Object.keys(positionLimits);
  const maxStarters = Object.values(positionLimits).reduce((sum, limit) => sum + limit.max, 0);

  return (
    <section className="space-y-3 rounded-lg bg-surface-100 p-4 shadow-card">
      <h2 className="text-lg font-semibold text-text-primary">
        Starting Lineup ({activePlayers.length}/{maxStarters})
      </h2>

      {activePlayers.length === 0 ? (
        <p className="text-sm text-text-secondary">No active players selected</p>
      ) : (
        <div className="space-y-5">
          {positions.map((position) => {
            const playersInPosition = allPlayers.filter((player) => player.position === position);
            if (playersInPosition.length === 0) {
              return null;
            }

            return (
              <PositionGroup
                key={position}
                position={position}
                players={playersInPosition}
                onTogglePlayer={onTogglePlayer}
                limits={positionLimits[position]}
                activePlayerIds={activePlayerIds}
                disabled={disabled}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

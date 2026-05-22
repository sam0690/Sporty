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
    <section className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl animate-[fade-soft_0.2s_ease]">
      <h2 className="text-md font-medium text-foreground">
        Starting Lineup ({activePlayers.length}/{maxStarters})
      </h2>

      {activePlayers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-center text-sm text-foreground/55">
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

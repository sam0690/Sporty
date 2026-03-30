"use client";

import { PlayerSlot, type Player } from "@/components/dashboard/leagues/league-lineup/components/PlayerSlot";

type PositionLimit = {
  max: number;
  current: number;
};

type PositionGroupProps = {
  position: string;
  players: Player[];
  onTogglePlayer: (playerId: number) => void;
  limits: PositionLimit;
  activePlayerIds: number[];
  disabled?: boolean;
};

function positionIcon(position: string): string {
  if (position === "Forward") return "⚡";
  if (position === "Midfielder") return "🎯";
  if (position === "Defender") return "🛡️";
  if (position === "Goalkeeper") return "🧤";
  if (position === "PointGuard") return "🎯";
  if (position === "ShootingGuard") return "🎯";
  if (position === "SmallForward") return "⚡";
  if (position === "PowerForward") return "⚡";
  if (position === "Center") return "🏀";
  if (position === "Batsman") return "🏏";
  if (position === "Bowler") return "🎳";
  if (position === "AllRounder") return "🏏";
  if (position === "WicketKeeper") return "🧤";
  return "👤";
}

export function PositionGroup({
  position,
  players,
  onTogglePlayer,
  limits,
  activePlayerIds,
  disabled = false,
}: PositionGroupProps) {
  const activeCount = players.filter((player) => activePlayerIds.includes(player.id)).length;

  return (
    <section className="space-y-3">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-text-primary">
          {positionIcon(position)} {position}
        </h3>
        <p className="text-sm text-text-secondary">{activeCount}/{limits.max} selected</p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {players.map((player) => (
          <PlayerSlot
            key={player.id}
            player={player}
            isActive={activePlayerIds.includes(player.id)}
            onToggle={onTogglePlayer}
            disabled={disabled}
          />
        ))}
      </div>
    </section>
  );
}

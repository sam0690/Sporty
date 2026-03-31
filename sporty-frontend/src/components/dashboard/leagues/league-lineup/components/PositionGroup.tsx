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
  disabled = false,
}: PositionGroupProps) {
  const activeCount = players.length;
  const emptySlots = Math.max(0, limits.max - activeCount);

  return (
    <section className="space-y-3 rounded-xl border border-gray-100 p-4">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">
          {positionIcon(position)} {position}
        </h3>
        <p className={`text-sm ${activeCount >= limits.max ? "text-amber-600" : "text-gray-500"}`}>
          {activeCount}/{limits.max}
        </p>
      </header>

      <div className="space-y-2">
        {players.map((player) => (
          <PlayerSlot
            key={player.id}
            player={player}
            isActive={true}
            onToggle={onTogglePlayer}
            variant="lineup"
            disabled={disabled}
          />
        ))}

        {Array.from({ length: emptySlots }).map((_, index) => (
          <div
            key={`${position}-empty-${index}`}
            className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-4 text-center text-sm text-gray-400 transition-all duration-150"
          >
            Drop {position} here
          </div>
        ))}
      </div>
    </section>
  );
}

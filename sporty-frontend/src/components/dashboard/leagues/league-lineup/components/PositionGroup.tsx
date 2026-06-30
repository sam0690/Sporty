"use client";

import {
  PlayerSlot,
  type Player,
} from "@/components/dashboard/leagues/league-lineup/components/PlayerSlot";

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
    <section className="space-y-3 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4">
      <header className="mb-3 flex items-center justify-between">
        <p className="section-label">
          {positionIcon(position)} {position}
        </p>
        <p
          className={`font-bebas text-base leading-none tracking-[1px] tabular-nums ${
            activeCount >= limits.max ? "text-[#e8fb25]" : "text-[#555560]"
          }`}
        >
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
            className="rounded-[3px] border border-dashed border-[rgba(255,255,255,0.08)] bg-[#0d0d12] p-4 text-center font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-[#555560] transition-all duration-150"
          >
            Drop {position} here
          </div>
        ))}
      </div>
    </section>
  );
}

"use client";

import type { ComponentType } from "react";
import { Zap, Target, Shield, Hand, Circle, User } from "lucide-react";
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

function positionIcon(position: string): ComponentType<{ className?: string }> {
  if (position === "Forward" || position === "SmallForward" || position === "PowerForward")
    return Zap;
  if (position === "Midfielder" || position === "PointGuard" || position === "ShootingGuard")
    return Target;
  if (position === "Defender") return Shield;
  if (position === "Goalkeeper" || position === "WicketKeeper") return Hand;
  if (position === "Center" || position === "Batsman" || position === "Bowler" || position === "AllRounder")
    return Circle;
  return User;
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
    <section className="space-y-3 rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] p-4">
      <header className="mb-3 flex items-center justify-between">
        <p className="section-label flex items-center gap-1.5">
          {(() => {
            const PosIcon = positionIcon(position);
            return <PosIcon className="h-3.5 w-3.5" />;
          })()}
          {position}
        </p>
        <p
          className={`font-bebas text-base leading-none tracking-[1px] tabular-nums ${
            activeCount >= limits.max ? "text-[#DC2626]" : "text-[#6B7280]"
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
            className="rounded-[3px] border border-dashed border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] p-4 text-center font-barlow-condensed text-xs font-bold uppercase tracking-[1px] text-[#6B7280] transition-all duration-150"
          >
            Drop {position} here
          </div>
        ))}
      </div>
    </section>
  );
}

"use client";

import { GripVertical, Plus, X } from "lucide-react";

type Sport = "football" | "basketball" | "cricket";

type Player = {
  id: any;
  name: string;
  sport: Sport;
  position: string;
  projected: number;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
};

type PlayerSlotProps = {
  player: Player;
  onToggle: (playerId: number) => void;
  isActive: boolean;
  variant?: "lineup" | "bench";
  disabled?: boolean;
};

const sportAccentColor: Record<Sport, string> = {
  football: "#16A34A",
  basketball: "#EA580C",
  cricket: "#0891B2",
};

export function PlayerSlot({
  player,
  onToggle,
  isActive,
  variant = "lineup",
  disabled = false,
}: PlayerSlotProps) {
  return (
    <article
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => { if (!disabled) onToggle(player.id); }}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle(player.id);
        }
      }}
      style={{ borderLeft: `3px solid ${sportAccentColor[player.sport]}` }}
      className={`group flex items-center justify-between rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] p-3 transition-colors ${
        variant === "bench" ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
      } ${disabled ? "cursor-not-allowed opacity-60" : "hover:bg-[#F3F4F7]"}`}
      aria-disabled={disabled}
    >
      <div className="min-w-0">
        <p className="truncate font-barlow-condensed text-sm font-bold uppercase tracking-[1px] text-[#0B1220]">
          {player.name}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span className="font-barlow-condensed text-[10px] font-bold uppercase tracking-[1px] text-[#6B7280]">
            {player.position}
          </span>
          <span className="section-label">Proj: {player.projected.toFixed(1)}</span>
        </div>
      </div>

      <div className="ml-3 flex items-center gap-2">
        {variant === "bench" ? (
          <GripVertical className="h-4 w-4 text-[#6B7280]" />
        ) : null}
        <button
          type="button"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            if (!disabled) onToggle(player.id);
          }}
          className="rounded-[3px] border border-[rgba(11,18,32,0.08)] p-1 text-[#6B7280] transition-colors hover:border-[rgba(255,59,48,0.3)] hover:text-[#DC2626] disabled:opacity-60"
          aria-label={isActive ? "Remove from lineup" : "Add to lineup"}
        >
          {isActive ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </button>
      </div>
    </article>
  );
}

export type { Player, Sport };

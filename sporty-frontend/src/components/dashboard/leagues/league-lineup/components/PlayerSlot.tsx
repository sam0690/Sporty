"use client";

import { GripVertical, Plus, X } from "lucide-react";

type Sport = "football" | "basketball" | "cricket";

type Player = {
  id: number;
  name: string;
  sport: Sport;
  position: string;
  projected: number;
};

type PlayerSlotProps = {
  player: Player;
  onToggle: (playerId: number) => void;
  isActive: boolean;
  variant?: "lineup" | "bench";
  disabled?: boolean;
};

const sportBadgeStyles: Record<Sport, string> = {
  football: "bg-accent-football/10 text-accent-football",
  basketball: "bg-accent-basketball/10 text-accent-basketball",
  cricket: "bg-accent-cricket/10 text-accent-cricket",
};

const sportIcons: Record<Sport, string> = {
  football: "⚽",
  basketball: "🏀",
  cricket: "🏏",
};

export function PlayerSlot({ player, onToggle, isActive, variant = "lineup", disabled = false }: PlayerSlotProps) {
  return (
    <article
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => {
        if (!disabled) {
          onToggle(player.id);
        }
      }}
      onKeyDown={(event) => {
        if (disabled) {
          return;
        }

        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onToggle(player.id);
        }
      }}
      className={`group flex items-center justify-between rounded-xl border p-3 transition-all duration-150 [animation:fade-soft_0.2s_ease] ${
        isActive
          ? "border-gray-100 bg-white"
          : "border-gray-100 bg-white"
      } ${
        variant === "bench" ? "cursor-grab active:cursor-grabbing hover:bg-gray-50" : "cursor-pointer"
      } ${disabled ? "cursor-not-allowed opacity-60" : "active:rotate-1 active:opacity-50 active:shadow-lg"}`}
      aria-disabled={disabled}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium text-gray-900">{player.name}</p>
        </div>
        <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
          <span className={`rounded px-2 py-0.5 text-xs capitalize ${sportBadgeStyles[player.sport]}`}>
            {sportIcons[player.sport]}
          </span>
          <span>{player.position}</span>
        </div>
        <p className="mt-1 text-sm text-gray-600">
          Projected: {player.projected.toFixed(1)}
        </p>
      </div>

      <div className="ml-3 flex items-center gap-2">
        {variant === "bench" ? <GripVertical className="h-4 w-4 text-gray-400" /> : null}
        <button
          type="button"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            if (!disabled) {
              onToggle(player.id);
            }
          }}
          className="rounded-full p-1 text-gray-400 transition-colors hover:text-red-500 disabled:opacity-60"
          aria-label={isActive ? "Remove from lineup" : "Add to lineup"}
        >
          {isActive ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </button>
      </div>
    </article>
  );
}

export type { Player, Sport };

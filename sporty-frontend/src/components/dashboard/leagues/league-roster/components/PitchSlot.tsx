"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { DropZone } from "@/components/dashboard/leagues/league-roster/components/DropZone";
import { PlayerStatsCard } from "@/components/dashboard/leagues/league-roster/components/PlayerStatsCard";
import type { Player } from "@/components/dashboard/leagues/league-roster/components/PlayerCard";

type PitchSlotConfig = {
  id: number;
  label: string;
  shortLabel: string;
};

type PitchSlotProps = {
  slot: PitchSlotConfig;
  player: Player | null;
  dropId: string;
  isDropDisabled: boolean;
  onRemove: (slotId: number) => void;
  onSelectPlayer?: (playerId: number) => void;
  isSelected?: boolean;
};

const sportIcons = {
  football: "⚽",
  basketball: "🏀",
  cricket: "🏏",
};

const ringStyles = {
  football: "ring-2 ring-blue-400/50",
  basketball: "ring-2 ring-orange-400/50",
  cricket: "ring-2 ring-amber-600/50",
};

export function PitchSlot({
  slot,
  player,
  dropId,
  isDropDisabled,
  onRemove,
  onSelectPlayer,
  isSelected = false,
}: PitchSlotProps) {
  const draggable = useDraggable({
    id: player ? `player-${player.id}` : `empty-${slot.id}`,
    disabled: !player,
    data: player
      ? {
          type: "player",
          playerId: player.id,
          from: "slot",
          slotId: slot.id,
        }
      : undefined,
  });

  const style = player
    ? {
        transform: CSS.Translate.toString(draggable.transform),
        opacity: draggable.isDragging ? 0.5 : 1,
      }
    : undefined;

  return (
    <DropZone
      id={dropId}
      disabled={isDropDisabled}
      className="group relative"
      activeClassName="scale-105"
    >
      <div
        ref={player ? draggable.setNodeRef : undefined}
        style={style}
        {...(player ? draggable.listeners : undefined)}
        {...(player ? draggable.attributes : undefined)}
        onClick={() => {
          if (player && onSelectPlayer) {
            onSelectPlayer(player.id);
          }
        }}
        title={
          player
            ? `${player.name} | ${player.position} | Total: ${player.totalPoints} | Avg: ${player.avgPoints.toFixed(1)}`
            : slot.label
        }
        className={`relative flex h-10 w-10 items-center justify-center rounded-full text-center transition-all duration-150 sm:h-14 sm:w-14 ${
          player
            ? `cursor-grab bg-white shadow-md hover:scale-105 hover:shadow-lg ${ringStyles[player.sport]} ${isSelected ? "outline-2 outline-offset-2 outline-white" : ""}`
            : "border border-dashed border-white/40 bg-white/20 backdrop-blur-sm"
        } ${draggable.isDragging ? "rotate-1 shadow-lg" : ""} ${!isDropDisabled ? "" : "opacity-70"}`}
      >
        {player ? (
          <>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm sm:h-10 sm:w-10">
              {sportIcons[player.sport]}
            </div>
            <div className="pointer-events-none absolute top-[calc(100%+4px)] left-1/2 -translate-x-1/2 text-center">
              <p className="w-20 truncate text-xs font-medium text-white/90">
                {player.name}
              </p>
              <p className="text-[10px] text-white/70">
                {player.totalPoints} pts
              </p>
            </div>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRemove(slot.id);
              }}
              className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] text-gray-500 shadow hover:text-red-500"
              aria-label={`Bench ${player.name}`}
            >
              x
            </button>

            <PlayerStatsCard player={player} />
          </>
        ) : (
          <div className="text-xs text-white/80">{slot.shortLabel}</div>
        )}
      </div>

      {player ? null : (
        <p className="pointer-events-none absolute top-[calc(100%+4px)] left-1/2 w-20 -translate-x-1/2 text-center text-[10px] text-white/70">
          {slot.label}
        </p>
      )}
    </DropZone>
  );
}

export type { PitchSlotConfig };

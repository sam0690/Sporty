"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { DropZone } from "@/components/dashboard/leagues/league-roster/components/DropZone";
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
};

const sportIcons = {
  football: "⚽",
  basketball: "🏀",
  cricket: "🏏",
};

const ringStyles = {
  football: "ring-2 ring-primary-500",
  basketball: "ring-2 ring-orange-500",
  cricket: "ring-2 ring-amber-700",
};

export function PitchSlot({ slot, player, dropId, isDropDisabled, onRemove }: PitchSlotProps) {
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
        opacity: draggable.isDragging ? 0.45 : 1,
      }
    : undefined;

  return (
    <DropZone
      id={dropId}
      disabled={isDropDisabled}
      className="w-28 sm:w-32"
      activeClassName="scale-105"
    >
      <div
        ref={player ? draggable.setNodeRef : undefined}
        style={style}
        {...(player ? draggable.listeners : undefined)}
        {...(player ? draggable.attributes : undefined)}
        title={player ? `${player.name} | ${player.position} | Total: ${player.totalPoints} | Avg: ${player.avgPoints.toFixed(1)}` : slot.label}
        className={`rounded-xl border bg-white/95 p-2 text-center shadow-card transition ${
          player ? "cursor-grab border-white/80" : "border-dashed border-white/60 bg-white/10"
        }`}
      >
        <p className="text-[10px] font-medium uppercase tracking-wide text-text-secondary">{slot.shortLabel}</p>
        {player ? (
          <>
            <div className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm ${ringStyles[player.sport]}`}>
              {sportIcons[player.sport]}
            </div>
            <p className="mt-1 truncate text-xs font-semibold text-text-primary">{player.name}</p>
            <button
              type="button"
              onClick={() => onRemove(slot.id)}
              className="mt-1 rounded-md bg-surface-100 px-2 py-0.5 text-[10px] text-text-secondary hover:bg-surface-200"
            >
              Bench
            </button>
          </>
        ) : (
          <div className="mt-1 text-lg text-white/80">+</div>
        )}
      </div>
    </DropZone>
  );
}

export type { PitchSlotConfig };

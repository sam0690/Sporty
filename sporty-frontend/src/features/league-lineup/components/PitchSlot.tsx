"use client";

import { memo, type KeyboardEvent } from "react";
import { useDraggable } from "@dnd-kit/core";
import { motion, useReducedMotion } from "framer-motion";
import { PlayerAvatar } from "@/components/ui";
import { DropZone } from "./DropZone";
import type { FormationSlot } from "@/components/dashboard/shared/formation/formationEngine";
import {
  getSportAccentClass,
  getSportIcon,
} from "@/components/dashboard/shared/formation/sportRegistry";
import type { PitchPlayer } from "./pitchPlayer";

// ── Presentational chip reused by the pitch marker and the drag overlay so the
// preview faithfully matches the dragged item. ──────────────────────────────
export function PlayerChip({
  player,
  isCaptain,
  isViceCaptain,
  isSelected,
  elevated = false,
}: {
  player: PitchPlayer;
  isCaptain?: boolean;
  isViceCaptain?: boolean;
  isSelected?: boolean;
  elevated?: boolean;
}) {
  return (
    <div className="relative">
      <div
        className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded-[3px] border border-white/25 bg-white shadow-lg sm:h-14 sm:w-14 ${
          isSelected ? "ring-2 ring-accent" : ""
        } ${elevated ? "shadow-2xl" : ""}`}
      >
        <PlayerAvatar
          name={player.name}
          photoUrl={player.photoUrl}
          size="md"
          className="!h-full !w-full !rounded-none !border-0 !bg-transparent"
        />
      </div>

      {isCaptain ? (
        <div className="absolute -left-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-[3px] bg-yellow-400 text-[10px] font-700 text-yellow-950 shadow-sm ring-2 ring-white/10">
          C
        </div>
      ) : isViceCaptain ? (
        <div className="absolute -left-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-[3px] bg-sky-400 text-[10px] font-700 text-sky-950 shadow-sm ring-2 ring-white/10">
          VC
        </div>
      ) : null}

      <div
        className={`absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-[3px] border text-[9px] font-700 shadow-sm ring-2 ring-white/10 ${getSportAccentClass(
          player.sport,
        )}`}
      >
        {getSportIcon(player.sport)}
      </div>
    </div>
  );
}

type PitchSlotProps = {
  slot: FormationSlot<PitchPlayer>;
  player: PitchPlayer | null;
  isSelected: boolean;
  isDropDisabled: boolean;
  /** A drag/tap interaction can legally land here → emphasize as a target. */
  isEligible: boolean;
  /** The slot directly under an active drag pointer. */
  isHoveredTarget: boolean;
  /** Drag in progress and this slot is not a legal target → fade it back. */
  isDimmed: boolean;
  /** Hovered target is occupied and the occupant would be displaced. */
  isDisplaced: boolean;
  isShaking: boolean;
  isCaptain: boolean;
  isViceCaptain: boolean;
  onRemove: (slotId: string) => void;
  /** Mouse tap AND keyboard Enter/Space both route through this — see
   * LineupPitchView's handleSlotTap for the select-then-place state machine. */
  onSlotTap: (slotId: string) => void;
};

export const PitchSlot = memo(function PitchSlot({
  slot,
  player,
  isSelected,
  isDropDisabled,
  isEligible,
  isHoveredTarget,
  isDimmed,
  isDisplaced,
  isShaking,
  isCaptain,
  isViceCaptain,
  onRemove,
  onSlotTap,
}: PitchSlotProps) {
  const prefersReducedMotion = useReducedMotion();
  const draggable = useDraggable({
    id: player ? `player-${player.id}` : `empty-${slot.id}`,
    disabled: !player,
    data: player
      ? { type: "player", playerId: player.id, from: "slot", slotId: slot.id }
      : undefined,
  });

  // With a DragOverlay we deliberately do NOT translate the source node — the
  // overlay is the single drag visual and layout animations own the settle.
  const style = player
    ? { opacity: draggable.isDragging ? 0.4 : 1, touchAction: "none" as const }
    : undefined;

  // Target emphasis: the single hovered slot gets the strongest treatment, all
  // other eligible slots a soft ring, and ineligible slots fade back during a
  // drag rather than shouting red across the whole pitch.
  const targetClass = isHoveredTarget
    ? isEligible
      ? "ring-2 ring-emerald-400 scale-110"
      : "ring-2 ring-red-500/60 scale-105"
    : isEligible
      ? "ring-2 ring-emerald-400/45"
      : "";

  const shakeAnimation =
    isShaking && !prefersReducedMotion ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 };

  // Keyboard alternative to drag-drop: Enter/Space triggers the same
  // select-then-place flow as a mouse tap (dnd-kit's own keyboard sensor is
  // deliberately overridden here — nudging by pixel deltas doesn't reliably
  // land on a specific pitch slot, so tabbing + Enter goes through the
  // semantic slot-tap path instead).
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSlotTap(slot.id);
    }
  };

  const ariaLabel = player
    ? `${player.name}, ${slot.label}${player.isStarter ? ", starting" : ", bench"}${isSelected ? ", selected" : ""}`
    : `Empty ${slot.label} slot${isEligible ? ", eligible drop target" : ""}`;

  return (
    <DropZone
      id={`slot-${slot.id}`}
      disabled={isDropDisabled}
      className={`group relative h-20 w-20 rounded-[3px] transition-all sm:h-24 sm:w-24 ${targetClass} ${
        isDimmed ? "opacity-40" : ""
      }`}
      activeClassName="!z-30"
    >
      <motion.div
        ref={player ? draggable.setNodeRef : undefined}
        style={style}
        {...(player ? draggable.listeners : undefined)}
        {...(player ? draggable.attributes : undefined)}
        animate={shakeAnimation}
        transition={{ duration: 0.4 }}
        onClick={() => onSlotTap(slot.id)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="button"
        aria-label={ariaLabel}
        className={`relative flex flex-col items-center justify-center ${
          player
            ? `cursor-pointer p-1 ${
                isSelected
                  ? "rounded-[3px] ring-2 ring-white/40 ring-offset-2 ring-offset-green-900/40"
                  : ""
              }`
            : "h-12 w-12 cursor-pointer rounded-[3px] border border-dashed border-white/20 bg-surface-3 backdrop-blur-[2px]"
        }`}
      >
        {player ? (
          <motion.div
            // Keyed by player id (not just slot.id above) so a cross-position
            // swap — which reshuffles row bucket sizes and can hand this same
            // slot to a different occupant — unmounts the outgoing player's
            // chip and mounts a fresh one instead of one instance silently
            // reassigning its layoutId mid-flight (that's what caused the
            // stuck/overlapping chip until a second interaction forced a
            // clean re-render).
            key={player.id}
            layoutId={
              prefersReducedMotion ? undefined : `pitch-player-${player.id}`
            }
            layout={!prefersReducedMotion}
            initial={prefersReducedMotion ? false : { scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 520, damping: 34 }}
            className={`relative transition-opacity ${isDisplaced ? "opacity-50" : ""}`}
          >
            <PlayerChip
              player={player}
              isCaptain={isCaptain}
              isViceCaptain={isViceCaptain}
              isSelected={isSelected}
              elevated={draggable.isDragging}
            />

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRemove(slot.id);
              }}
              className="absolute -right-3 bottom-8 flex h-5 w-5 translate-y-1/2 items-center justify-center rounded-[3px] bg-red-500/90 text-[10px] text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 hover:bg-red-600"
              aria-label={`Remove ${player.name}`}
            >
              ×
            </button>

            <div className="absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 text-center">
              <p className="w-20 truncate rounded bg-black/50 px-1 py-0.5 font-sans text-[10px] font-700 uppercase tracking-[0.5px] text-white backdrop-blur-xs">
                {player.name}
              </p>
              <p className="mt-0.5 text-[9px] uppercase tracking-[2px] text-white/80">
                {player.position}
              </p>
            </div>
          </motion.div>
        ) : (
          <div className="pointer-events-none flex flex-col items-center">
            <span className="text-[9px] font-700 uppercase text-white/40">
              {slot.label}
            </span>
          </div>
        )}
      </motion.div>
    </DropZone>
  );
});

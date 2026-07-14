"use client";
// dnd-kit's useSortable exposes setNodeRef/listeners/attributes that must be
// spread onto the node during render — the idiomatic usage the library is built
// around. The react-hooks/refs rule flags this as a false positive, so it stays
// disabled for this file (it does NOT mask any of our own ref-in-render code).
/* eslint-disable react-hooks/refs */

import { memo, type KeyboardEvent } from "react";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, useReducedMotion } from "framer-motion";
import { Badge } from "@/components/ui";
import { DropZone } from "./DropZone";
import { getSportIcon } from "@/lib/formation/sportRegistry";
import type { PitchPlayer } from "./pitchPlayer";

type DraggableBenchPlayerCardProps = {
  player: PitchPlayer;
  isSelected: boolean;
  onTap: (playerId: string) => void;
};

const DraggableBenchPlayerCard = memo(function DraggableBenchPlayerCard({
  player,
  isSelected,
  onTap,
}: DraggableBenchPlayerCardProps) {
  const prefersReducedMotion = useReducedMotion();
  // useSortable (not plain useDraggable) so a bench card is both draggable
  // (out to the pitch, or onto another bench card to reorder) AND droppable
  // (so a starter/bench card can be dropped onto it) within the same
  // DndContext — see LineupPitchView's handleDragEnd for how the two
  // gestures are told apart.
  const sortable = useSortable({
    id: `player-${player.id}`,
    data: { type: "player", playerId: player.id, from: "bench" },
  });

  // Keyboard alternative to drag-drop: Enter/Space selects the player (same
  // select-then-place flow a mouse tap starts) — dnd-kit's own keyboard
  // sortable behavior is deliberately overridden below so Tab+Enter goes
  // through the semantic tap path instead of a simulated reorder drag.
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onTap(player.id);
    }
  };

  return (
    <motion.article
      ref={sortable.setNodeRef}
      style={{
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition,
        touchAction: "none",
      }}
      {...sortable.listeners}
      {...sortable.attributes}
      layout={!prefersReducedMotion}
      initial={prefersReducedMotion ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: sortable.isDragging ? 0.45 : 1, y: 0 }}
      transition={{ duration: 0.18 }}
      onClick={() => onTap(player.id)}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${player.name}, ${player.position}, bench${isSelected ? ", selected" : ""}`}
      className={`cursor-pointer rounded-[3px] border p-3 transition-colors ${
        isSelected
          ? "border-accent/50 bg-accent/6"
          : "border-white/8 bg-surface-3 hover:border-accent/30"
      }`}
      title={`${player.name} | ${player.position} | ${player.realTeam} | Cost ${player.cost}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate font-sans text-sm font-700 uppercase tracking-[0.5px] text-fg-1">
          {player.name}
        </p>
        <span className="text-base" aria-label={player.sport}>
          {getSportIcon(player.sport)}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <Badge sport={player.sport} size="sm">
          {player.position}
        </Badge>
        <span className="font-display text-base leading-none tracking-[-0.02em] text-accent tabular-nums">
          {player.cost}
        </span>
      </div>
      <p className="mt-1 truncate text-xs text-fg-3">{player.realTeam}</p>
    </motion.article>
  );
});

type BenchListProps = {
  benchPlayers: PitchPlayer[];
  selectedPlayerId: string | null;
  onTap: (playerId: string) => void;
};

export function BenchList({ benchPlayers, selectedPlayerId, onTap }: BenchListProps) {
  return (
    <section className="space-y-4 card-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="section-label">Bench Players</p>
      </div>

      <DropZone
        id="bench-drop"
        className="max-h-155 space-y-2 overflow-y-auto rounded-[3px] pr-1"
        activeClassName="ring-2 ring-emerald-400/50"
      >
        {benchPlayers.length === 0 ? (
          <p className="rounded-[3px] border border-dashed border-white/8 bg-surface-2 p-4 text-center text-xs text-fg-3">
            No bench players. Drag a player here to bench them.
          </p>
        ) : (
          <SortableContext
            items={benchPlayers.map((player) => `player-${player.id}`)}
            strategy={verticalListSortingStrategy}
          >
            {benchPlayers.map((player) => (
              <DraggableBenchPlayerCard
                key={player.id}
                player={player}
                isSelected={selectedPlayerId === player.id}
                onTap={onTap}
              />
            ))}
          </SortableContext>
        )}
      </DropZone>
    </section>
  );
}

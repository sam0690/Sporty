"use client";
// dnd-kit's useDraggable exposes setNodeRef/listeners/attributes that must be
// spread onto the node during render — the idiomatic usage the library is built
// around. The react-hooks/refs rule flags this as a false positive, so it stays
// disabled for this file (it does NOT mask any of our own ref-in-render code).
/* eslint-disable react-hooks/refs */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { motion, useReducedMotion } from "framer-motion";
import { DropZone } from "@/components/dashboard/leagues/league-roster/components/DropZone";
import type { LineupPlayerCardModel } from "@/components/dashboard/leagues/league-lineup/hooks/useLeagueLineupData";
import type {
  LineupPositionMap,
  SlotCoord,
} from "@/components/dashboard/leagues/league-lineup/hooks/useLineupPositions";
import { FormationRenderer } from "@/components/dashboard/shared/formation/FormationRenderer";
import {
  buildTeamLayout,
  type FormationSlot,
} from "@/components/dashboard/shared/formation/formationEngine";
import {
  getSportAccentClass,
  getSportIcon,
  type SportKind,
} from "@/components/dashboard/shared/formation/sportRegistry";
import { toastifier } from "@/lib/toastifier";

type LineupPitchViewProps = {
  allPlayers: LineupPlayerCardModel[];
  positions: LineupPositionMap;
  onSetPosition: (playerId: string, coord: SlotCoord) => void;
  onClearPosition: (playerId: string) => void;
  onResetPositions: () => void;
  onToggleStarter: (playerId: string) => void;
  onSetCaptain: (playerId: string) => void;
  onSetViceCaptain: (playerId: string) => void;
  starterLimitReached: boolean;
  disabled?: boolean;
};

type PitchPlayer = {
  id: string;
  playerId: string;
  name: string;
  sport: SportKind;
  position: string;
  realTeam: string;
  cost: string;
  isStarter: boolean;
};

const MULTISPORT_STARTER_REQUIREMENTS = {
  football: 5,
  basketball: 4,
} as const;

// Drops snap to exact slot coordinates, so a tight epsilon reliably matches a
// stored coordinate back to its slot while tolerating float rounding.
const COORD_EPSILON = 0.005;

function coordsMatch(a: SlotCoord | undefined, b: SlotCoord): boolean {
  if (!a) {
    return false;
  }
  return Math.abs(a.x - b.x) < COORD_EPSILON && Math.abs(a.y - b.y) < COORD_EPSILON;
}

// ── Presentational chip reused by the pitch marker and the drag overlay so the
// preview faithfully matches the dragged item. ──────────────────────────────
function PlayerChip({
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
        className={`flex h-12 w-12 items-center justify-center rounded-[3px] border border-white/25 bg-white shadow-lg sm:h-14 sm:w-14 ${
          isSelected ? "ring-2 ring-accent-primary" : ""
        } ${elevated ? "shadow-2xl" : ""}`}
      >
        <span className="text-xl">{getSportIcon(player.sport)}</span>
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

type PitchSlotMarkerProps = {
  slot: FormationSlot<PitchPlayer>;
  player: PitchPlayer | null;
  isSelected: boolean;
  isDropDisabled: boolean;
  isValidTarget: boolean;
  isDragActive: boolean;
  isShaking: boolean;
  isCaptain: boolean;
  isViceCaptain: boolean;
  onRemove: (slotId: string) => void;
  onSelectPlayer: (playerId: string) => void;
};

const PitchSlotMarker = memo(function PitchSlotMarker({
  slot,
  player,
  isSelected,
  isDropDisabled,
  isValidTarget,
  isDragActive,
  isShaking,
  isCaptain,
  isViceCaptain,
  onRemove,
  onSelectPlayer,
}: PitchSlotMarkerProps) {
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

  // Highlight valid / invalid targets across the whole pitch while dragging —
  // not just the slot under the pointer.
  const targetRing = isDragActive
    ? isValidTarget
      ? "ring-2 ring-emerald-400/70"
      : "ring-2 ring-red-500/40"
    : "";

  const shakeAnimation =
    isShaking && !prefersReducedMotion ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 };

  return (
    <DropZone
      id={`slot-${slot.id}`}
      disabled={isDropDisabled}
      className={`group relative h-20 w-20 rounded-[3px] transition-transform sm:h-24 sm:w-24 ${targetRing}`}
      activeClassName="scale-110 !z-30"
    >
      <motion.div
        ref={player ? draggable.setNodeRef : undefined}
        style={style}
        {...(player ? draggable.listeners : undefined)}
        {...(player ? draggable.attributes : undefined)}
        animate={shakeAnimation}
        transition={{ duration: 0.4 }}
        onClick={() => {
          if (player) {
            onSelectPlayer(player.id);
          }
        }}
        className={`relative flex flex-col items-center justify-center ${
          player
            ? `cursor-grab p-1 ${
                isSelected
                  ? "rounded-[3px] ring-2 ring-white/40 ring-offset-2 ring-offset-green-900/40"
                  : ""
              }`
            : "h-12 w-12 rounded-[3px] border border-dashed border-white/20 bg-[#1d1d26] backdrop-blur-[2px]"
        }`}
      >
        {player ? (
          <motion.div
            layoutId={
              prefersReducedMotion ? undefined : `pitch-player-${player.id}`
            }
            layout={!prefersReducedMotion}
            initial={prefersReducedMotion ? false : { scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 520, damping: 34 }}
            className="relative"
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
              <p className="w-20 truncate rounded bg-black/50 px-1 py-0.5 text-[10px] font-700 text-white backdrop-blur-xs">
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

type DraggableBenchPlayerCardProps = {
  player: PitchPlayer;
};

const DraggableBenchPlayerCard = memo(function DraggableBenchPlayerCard({
  player,
}: DraggableBenchPlayerCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const draggable = useDraggable({
    id: `player-${player.id}`,
    data: { type: "player", playerId: player.id, from: "bench" },
  });

  return (
    <motion.article
      ref={draggable.setNodeRef}
      style={{ touchAction: "none" }}
      {...draggable.listeners}
      {...draggable.attributes}
      layout={!prefersReducedMotion}
      initial={prefersReducedMotion ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: draggable.isDragging ? 0.45 : 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="cursor-grab rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-3 transition-shadow hover:shadow-[0_16px_44px_rgba(0,0,0,0.28)]"
      title={`${player.name} | ${player.position} | ${player.realTeam} | Cost ${player.cost}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-600 text-[#f0f0f0]">{player.name}</p>
        <span className="text-base" aria-label={player.sport}>
          {getSportIcon(player.sport)}
        </span>
      </div>
      <p className="mt-1 text-xs text-[#555560]">{player.position}</p>
      <p className="mt-1 truncate text-xs text-[#555560]">{player.realTeam}</p>
      <p className="mt-1 text-xs text-[#e8fb25]">Cost {player.cost}</p>
    </motion.article>
  );
});

export function LineupPitchView({
  allPlayers,
  positions,
  onSetPosition,
  onClearPosition,
  onResetPositions,
  onToggleStarter,
  onSetCaptain,
  onSetViceCaptain,
  starterLimitReached,
  disabled = false,
}: LineupPitchViewProps) {
  const pitchPlayers = useMemo<PitchPlayer[]>(
    () =>
      allPlayers.map((player) => ({
        id: player.playerId,
        playerId: player.playerId,
        name: player.name,
        sport: player.sport,
        position: player.position,
        realTeam: player.realTeam,
        cost: player.cost,
        isStarter: player.isStarter,
      })),
    [allPlayers],
  );

  const layout = useMemo(
    () => buildTeamLayout(pitchPlayers, { activeOnly: true }),
    [pitchPlayers],
  );

  const playerById = useMemo(
    () =>
      pitchPlayers.reduce<Record<string, PitchPlayer>>((acc, player) => {
        acc[player.id] = player;
        return acc;
      }, {}),
    [pitchPlayers],
  );

  const lineupPlayerById = useMemo(
    () =>
      allPlayers.reduce<Record<string, LineupPlayerCardModel>>((acc, player) => {
        acc[player.playerId] = player;
        return acc;
      }, {}),
    [allPlayers],
  );

  const isMultiSport = layout.mode === "mixed";

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const prefersReducedMotion = useReducedMotion();
  const [activeDragPlayerId, setActiveDragPlayerId] = useState<string | null>(
    null,
  );
  const [selectedPitchPlayerId, setSelectedPitchPlayerId] = useState<
    string | null
  >(null);

  // Brief shake feedback on an invalid drop, keyed by the rejected slot.
  const [shakeSlotId, setShakeSlotId] = useState<string | null>(null);
  const shakeTimeoutRef = useRef<number | null>(null);
  const triggerShake = useCallback(
    (slotId: string) => {
      if (prefersReducedMotion) {
        return;
      }
      setShakeSlotId(slotId);
      if (shakeTimeoutRef.current !== null) {
        window.clearTimeout(shakeTimeoutRef.current);
      }
      shakeTimeoutRef.current = window.setTimeout(
        () => setShakeSlotId(null),
        450,
      );
    },
    [prefersReducedMotion],
  );
  useEffect(
    () => () => {
      if (shakeTimeoutRef.current !== null) {
        window.clearTimeout(shakeTimeoutRef.current);
      }
    },
    [],
  );

  // Flat list of slots (the stable skeleton + snap targets).
  const slots = useMemo(() => {
    const flat: FormationSlot<PitchPlayer>[] = [];
    layout.sections.forEach((section) => {
      section.slots.forEach((slot) => flat.push(slot));
    });
    return flat;
  }, [layout]);

  const slotById = useMemo(
    () =>
      slots.reduce<Record<string, FormationSlot<PitchPlayer>>>((acc, slot) => {
        acc[slot.id] = slot;
        return acc;
      }, {}),
    [slots],
  );

  // Resolve which player occupies each slot. Stored coordinates win; unmoved
  // players fall back to the engine's role-based default; anything left fills
  // remaining same-sport slots. This is fully deterministic because every
  // move/swap stores coordinates for *both* affected players.
  const { occupancyBySlot, coordByPlayerId } = useMemo(() => {
    const starters = pitchPlayers.filter((player) => player.isStarter);
    const assigned = new Set<string>();
    const occupancy: Record<string, string | null> = {};

    // Pass 1 — stored coordinates.
    for (const slot of slots) {
      const match = starters.find(
        (player) =>
          !assigned.has(player.id) &&
          player.sport === slot.sport &&
          coordsMatch(positions[player.id], { x: slot.x, y: slot.y }),
      );
      if (match) {
        occupancy[slot.id] = match.id;
        assigned.add(match.id);
      } else {
        occupancy[slot.id] = null;
      }
    }

    // Pass 2 — engine default for still-empty slots.
    for (const slot of slots) {
      if (occupancy[slot.id]) {
        continue;
      }
      const defaultId = slot.player?.id;
      if (defaultId && !assigned.has(defaultId)) {
        occupancy[slot.id] = defaultId;
        assigned.add(defaultId);
      }
    }

    // Pass 3 — safety net for any starter still unplaced (e.g. stale coord).
    for (const slot of slots) {
      if (occupancy[slot.id]) {
        continue;
      }
      const candidate = starters.find(
        (player) => !assigned.has(player.id) && player.sport === slot.sport,
      );
      if (candidate) {
        occupancy[slot.id] = candidate.id;
        assigned.add(candidate.id);
      }
    }

    const coords: Record<string, SlotCoord> = {};
    for (const slot of slots) {
      const occupantId = occupancy[slot.id];
      if (occupantId) {
        coords[occupantId] = { x: slot.x, y: slot.y };
      }
    }

    return { occupancyBySlot: occupancy, coordByPlayerId: coords };
  }, [pitchPlayers, slots, positions]);

  const benchPlayers = useMemo(
    () => pitchPlayers.filter((player) => !player.isStarter),
    [pitchPlayers],
  );

  const activeSportCounts = useMemo(
    () =>
      pitchPlayers
        .filter((player) => player.isStarter)
        .reduce<Record<string, number>>((acc, player) => {
          acc[player.sport] = (acc[player.sport] ?? 0) + 1;
          return acc;
        }, {}),
    [pitchPlayers],
  );

  const selectedLineupPlayer = useMemo(() => {
    if (!selectedPitchPlayerId) {
      return null;
    }
    const pitchPlayer = playerById[selectedPitchPlayerId];
    return pitchPlayer ? lineupPlayerById[pitchPlayer.playerId] ?? null : null;
  }, [lineupPlayerById, playerById, selectedPitchPlayerId]);

  // Can the active drag legally drop onto this slot? Drives target highlighting.
  const canDropToSlot = useCallback(
    (slotId: string): boolean => {
      if (!activeDragPlayerId) {
        return true;
      }
      const player = playerById[activeDragPlayerId];
      const slot = slotById[slotId];
      if (!player || !slot || slot.sport !== player.sport) {
        return false;
      }

      const occupantId = occupancyBySlot[slotId];
      // Swap / substitution into an occupied slot is always allowed.
      if (occupantId && occupantId !== player.id) {
        return true;
      }
      // Empty slot: only blocked when adding a bench player past the limit.
      if (!player.isStarter && starterLimitReached) {
        return false;
      }
      if (isMultiSport && !player.isStarter) {
        const limit =
          MULTISPORT_STARTER_REQUIREMENTS[
            player.sport as keyof typeof MULTISPORT_STARTER_REQUIREMENTS
          ] ?? 0;
        if ((activeSportCounts[player.sport] ?? 0) >= limit) {
          return false;
        }
      }
      return true;
    },
    [
      activeDragPlayerId,
      activeSportCounts,
      isMultiSport,
      occupancyBySlot,
      playerById,
      slotById,
      starterLimitReached,
    ],
  );

  const handleRemoveFromSlot = useCallback(
    (slotId: string) => {
      const playerId = occupancyBySlot[slotId];
      if (!playerId) {
        return;
      }
      const player = playerById[playerId];
      if (player?.isStarter) {
        onToggleStarter(player.playerId);
      }
      onClearPosition(playerId);
      if (selectedPitchPlayerId === playerId) {
        setSelectedPitchPlayerId(null);
      }
    },
    [occupancyBySlot, onClearPosition, onToggleStarter, playerById, selectedPitchPlayerId],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const dragData = event.active.data.current;
    if (dragData?.type === "player") {
      setActiveDragPlayerId(String(dragData.playerId));
    }
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragPlayerId(null);

      const dragData = event.active.data.current;
      if (!dragData || dragData.type !== "player") {
        return;
      }
      const dragged = playerById[String(dragData.playerId)];
      if (!dragged) {
        return;
      }

      const overId = event.over?.id;

      // Drop onto the bench (or nowhere) → bench the player.
      if (!overId || overId === "bench-drop") {
        if (dragged.isStarter) {
          onToggleStarter(dragged.playerId);
          onClearPosition(dragged.playerId);
          toastifier.info(`${dragged.name} moved to bench`);
        }
        setSelectedPitchPlayerId(null);
        return;
      }

      if (typeof overId !== "string" || !overId.startsWith("slot-")) {
        return;
      }
      const slot = slotById[overId.replace("slot-", "")];
      if (!slot) {
        return;
      }

      if (slot.sport !== dragged.sport) {
        triggerShake(slot.id);
        toastifier.error(`This is a ${slot.sport} slot.`);
        return;
      }

      const slotCoord: SlotCoord = { x: slot.x, y: slot.y };
      const occupantId = occupancyBySlot[slot.id];

      // ── Occupied slot → swap (pitch↔pitch) or substitution (bench→pitch) ──
      if (occupantId && occupantId !== dragged.id) {
        const occupant = playerById[occupantId];
        if (!occupant) {
          return;
        }
        if (dragged.isStarter) {
          // Swap two starters' positions.
          const previousCoord = coordByPlayerId[dragged.id];
          onSetPosition(dragged.playerId, slotCoord);
          if (previousCoord) {
            onSetPosition(occupant.playerId, previousCoord);
          } else {
            onClearPosition(occupant.playerId);
          }
        } else {
          // Substitute the bench player in for the occupant (count-neutral).
          onToggleStarter(dragged.playerId);
          onSetPosition(dragged.playerId, slotCoord);
          onToggleStarter(occupant.playerId);
          onClearPosition(occupant.playerId);
          toastifier.info(`${dragged.name} ↔ ${occupant.name}`);
        }
        setSelectedPitchPlayerId(dragged.id);
        return;
      }

      // ── Empty slot ──
      if (!dragged.isStarter) {
        if (starterLimitReached) {
          triggerShake(slot.id);
          toastifier.error("Starter limit reached.");
          return;
        }
        if (isMultiSport) {
          const limit =
            MULTISPORT_STARTER_REQUIREMENTS[
              dragged.sport as keyof typeof MULTISPORT_STARTER_REQUIREMENTS
            ] ?? 0;
          if ((activeSportCounts[dragged.sport] ?? 0) >= limit) {
            triggerShake(slot.id);
            toastifier.error(`Limit: ${limit} ${dragged.sport} players.`);
            return;
          }
        }
        onToggleStarter(dragged.playerId);
      }
      onSetPosition(dragged.playerId, slotCoord);
      setSelectedPitchPlayerId(dragged.id);
    },
    [
      activeSportCounts,
      coordByPlayerId,
      isMultiSport,
      occupancyBySlot,
      onClearPosition,
      onSetPosition,
      onToggleStarter,
      playerById,
      slotById,
      starterLimitReached,
      triggerShake,
    ],
  );

  const activeDragPlayer = activeDragPlayerId
    ? playerById[activeDragPlayerId]
    : null;

  return (
    <div className="space-y-6">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveDragPlayerId(null)}
      >
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
          <section className="space-y-4 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-600 text-[#f0f0f0]">
                Bench Players
              </h3>
              <button
                type="button"
                onClick={onResetPositions}
                disabled={disabled}
                className="rounded-[3px] border border-[rgba(255,255,255,0.08)] px-2 py-1 text-[11px] text-[#555560] transition hover:text-[#f0f0f0] disabled:cursor-not-allowed disabled:opacity-50"
                title="Reset pitch positions to the auto formation"
              >
                Reset formation
              </button>
            </div>

            <DropZone
              id="bench-drop"
              className="max-h-155 space-y-2 overflow-y-auto rounded-[3px] pr-1"
              activeClassName="ring-2 ring-emerald-400/50"
            >
              {benchPlayers.length === 0 ? (
                <p className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-3 text-sm text-[#555560]">
                  No bench players. Drag a player here to bench them.
                </p>
              ) : (
                benchPlayers.map((player) => (
                  <DraggableBenchPlayerCard key={player.id} player={player} />
                ))
              )}
            </DropZone>
          </section>

          <section className="mx-auto w-full max-w-2xl animate-[fade-soft_0.2s_ease]">
            {isMultiSport ? (
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[#f0f0f0]/75">
                <span className="rounded-[3px] border border-orange-400/20 bg-orange-500/10 px-3 py-1 text-orange-100">
                  🏀 Basketball: {activeSportCounts.basketball ?? 0} /{" "}
                  {MULTISPORT_STARTER_REQUIREMENTS.basketball}
                </span>
                <span className="rounded-[3px] border border-[rgba(232,251,37,0.3)] bg-[rgba(232,251,37,0.1)] px-3 py-1 text-[#e8fb25]">
                  ⚽ Football: {activeSportCounts.football ?? 0} /{" "}
                  {MULTISPORT_STARTER_REQUIREMENTS.football}
                </span>
              </div>
            ) : null}
            <FormationRenderer
              layout={layout}
              showSectionLabels={isMultiSport}
              renderSlot={({ slot }) => {
                const occupantId = occupancyBySlot[slot.id];
                const player = occupantId ? playerById[occupantId] ?? null : null;
                const lineupPlayer = player
                  ? lineupPlayerById[player.playerId]
                  : null;

                return (
                  <PitchSlotMarker
                    slot={slot}
                    player={player}
                    isDropDisabled={disabled || !canDropToSlot(slot.id)}
                    isValidTarget={canDropToSlot(slot.id)}
                    isDragActive={activeDragPlayerId !== null}
                    isShaking={shakeSlotId === slot.id}
                    isSelected={!!player && selectedPitchPlayerId === player.id}
                    isCaptain={!!lineupPlayer?.isCaptain}
                    isViceCaptain={!!lineupPlayer?.isViceCaptain}
                    onRemove={handleRemoveFromSlot}
                    onSelectPlayer={setSelectedPitchPlayerId}
                  />
                );
              }}
            />
          </section>
        </div>

        {/* dropAnimation disabled: the source's shared-layout animation owns
            the settle, so the overlay vanishes and the real chip slides home. */}
        <DragOverlay dropAnimation={null}>
          {activeDragPlayer ? (
            <motion.div
              className="flex flex-col items-center"
              initial={false}
              animate={
                prefersReducedMotion
                  ? { scale: 1 }
                  : { scale: 1.06, rotate: -2 }
              }
            >
              <PlayerChip player={activeDragPlayer} elevated />
              <p className="mt-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-700 text-white">
                {activeDragPlayer.name}
              </p>
            </motion.div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <section className="space-y-4 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-600 text-[#f0f0f0]">Captain Assignment</h3>
          <span className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-3 py-1 text-xs text-[#555560]">
            Click a player on the pitch to assign C/VC
          </span>
        </div>

        {!selectedLineupPlayer ? (
          <div className="rounded-[3px] border border-dashed border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4 text-center text-sm text-[#555560]">
            Select a starter on the pitch to assign captain or vice-captain.
          </div>
        ) : (
          <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4">
            <p className="text-sm font-600 text-[#f0f0f0]">
              {selectedLineupPlayer.name}
            </p>
            <p className="mt-1 text-xs text-[#555560]">
              {selectedLineupPlayer.position} • {selectedLineupPlayer.realTeam}
            </p>

            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-2 text-sm text-[#f0f0f0]">
                <input
                  type="checkbox"
                  checked={selectedLineupPlayer.isCaptain}
                  onChange={() => onSetCaptain(selectedLineupPlayer.playerId)}
                  disabled={disabled || selectedLineupPlayer.isViceCaptain}
                  className="h-4 w-4 rounded border-white/20 text-yellow-500 focus:ring-yellow-300"
                />
                Make Captain
              </label>

              <label className="flex items-center gap-2 text-sm text-[#f0f0f0]">
                <input
                  type="checkbox"
                  checked={selectedLineupPlayer.isViceCaptain}
                  onChange={() => onSetViceCaptain(selectedLineupPlayer.playerId)}
                  disabled={disabled || selectedLineupPlayer.isCaptain}
                  className="h-4 w-4 rounded border-white/20 text-blue-500 focus:ring-blue-300"
                />
                Make Vice-Captain
              </label>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

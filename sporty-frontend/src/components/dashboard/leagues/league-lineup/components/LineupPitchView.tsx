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
  pointerWithin,
  useDraggable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDownToLine, Crown, Plus, Shield, X } from "lucide-react";
import { PlayerAvatar } from "@/components/ui";
import { DropZone } from "@/components/dashboard/leagues/league-lineup/components/DropZone";
import type { LineupPlayerCardModel } from "@/components/dashboard/leagues/league-lineup/hooks/useLeagueLineupData";
import { FormationRenderer } from "@/components/dashboard/shared/formation/FormationRenderer";
import {
  buildTeamLayout,
  isFootballGoalkeeper,
  validateFootballFormation,
  type FormationSlot,
  type TeamLayout,
} from "@/components/dashboard/shared/formation/formationEngine";
import {
  getSportAccentClass,
  getSportIcon,
  type SportKind,
} from "@/components/dashboard/shared/formation/sportRegistry";
import { toastifier } from "@/lib/toastifier";

type LineupPitchViewProps = {
  allPlayers: LineupPlayerCardModel[];
  /** Bench priority order (player ids); drives auto-sub priority server-side. */
  benchOrder: string[];
  onReorderBench: (draggedId: string, targetId: string) => void;
  onToggleStarter: (playerId: string) => void;
  /** Atomic bench↔starter swap — must be used instead of two onToggleStarter
   * calls (see swapStarter's comment in LeagueLineup.tsx for why). */
  onSwapStarter: (benchPlayerId: string, starterPlayerId: string) => void;
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
  photoUrl?: string | null;
};

const MULTISPORT_STARTER_REQUIREMENTS = {
  football: 5,
  basketball: 4,
} as const;

const sportBadgeClass: Record<SportKind, string> = {
  football: "sport-badge-football",
  basketball: "sport-badge-basketball",
  cricket: "sport-badge-cricket",
  unknown: "sport-badge-multisport",
};

// Would this proposed starting XI still be legal? Football is bounds-checked
// against FPL's own rule (GK=1, DEF 3-5, MID 2-5, FWD 1-3 — see
// formationEngine.ts). Multisport's football contingent is only 5 players, so
// the full bounds table is mathematically infeasible there — only the
// unambiguous "exactly 1 keeper" rule applies. Basketball has no reliable
// per-position data (see formationEngine.ts), so it's never bounds-checked.
function validateNextStarters(
  nextStarters: PitchPlayer[],
  mode: TeamLayout<PitchPlayer>["mode"],
): { ok: true } | { ok: false; reason: string } {
  if (mode === "football") {
    return validateFootballFormation(nextStarters);
  }
  if (mode === "mixed") {
    const footballStarters = nextStarters.filter((p) => p.sport === "football");
    const goalkeeperCount = footballStarters.filter((p) =>
      isFootballGoalkeeper(p.position),
    ).length;
    if (goalkeeperCount !== 1) {
      return {
        ok: false,
        reason: "Your multisport lineup needs exactly 1 football goalkeeper.",
      };
    }
  }
  return { ok: true };
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

type PitchSlotMarkerProps = {
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
  onSlotTap: (slotId: string) => void;
};

const PitchSlotMarker = memo(function PitchSlotMarker({
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
              <p className="w-20 truncate rounded bg-black/50 px-1 py-0.5 font-barlow-condensed text-[10px] font-700 uppercase tracking-[0.5px] text-white backdrop-blur-xs">
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
  // DndContext — see handleDragEnd's "player-" branch for how the two
  // gestures are told apart.
  const sortable = useSortable({
    id: `player-${player.id}`,
    data: { type: "player", playerId: player.id, from: "bench" },
  });

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
      className={`cursor-pointer rounded-[3px] border p-3 transition-colors ${
        isSelected
          ? "border-accent/50 bg-accent/6"
          : "border-white/8 bg-surface-3 hover:border-accent/30"
      }`}
      title={`${player.name} | ${player.position} | ${player.realTeam} | Cost ${player.cost}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate font-barlow-condensed text-sm font-700 uppercase tracking-[0.5px] text-fg-1">
          {player.name}
        </p>
        <span className="text-base" aria-label={player.sport}>
          {getSportIcon(player.sport)}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <span
          className={`rounded-[3px] px-2 py-0.5 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1px] ${sportBadgeClass[player.sport]}`}
        >
          {player.position}
        </span>
        <span className="font-bebas text-base leading-none tracking-[1px] text-accent tabular-nums">
          {player.cost}
        </span>
      </div>
      <p className="mt-1 truncate text-xs text-fg-3">{player.realTeam}</p>
    </motion.article>
  );
});

export function LineupPitchView({
  allPlayers,
  benchOrder,
  onReorderBench,
  onToggleStarter,
  onSwapStarter,
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
        photoUrl: player.photoUrl,
      })),
    [allPlayers],
  );

  // Rows (and which formation they add up to) are entirely derived from the
  // current starters' real positions — there is no manual formation picker
  // and no per-player coordinate to persist, matching how FPL's own pitch
  // works (a player's "slot" is just which role-row they're in).
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

  // Prefer the slot under the pointer; fall back to nearest-center so a release
  // just outside a tight slot still snaps to the obvious target.
  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length === 0) {
      return closestCenter(args);
    }
    if (pointerCollisions.length === 1) {
      return pointerCollisions;
    }
    // Dense rows (4-5 players) can pack slot centers closer together than the
    // fixed marker hit-box on narrower viewports, so more than one drop zone
    // can legitimately contain the pointer. Break the tie deterministically by
    // nearest center instead of arbitrary DOM order, so an adjacent-slot swap
    // always lands on the intended target.
    const pointerMatchIds = new Set(pointerCollisions.map((collision) => collision.id));
    const narrowedContainers = args.droppableContainers.filter((container) =>
      pointerMatchIds.has(container.id),
    );
    return closestCenter({ ...args, droppableContainers: narrowedContainers });
  }, []);

  const prefersReducedMotion = useReducedMotion();
  const [activeDragPlayerId, setActiveDragPlayerId] = useState<string | null>(
    null,
  );
  // Unified selection: drives tap-to-place, the bench highlight, and the
  // selected-player action bar. Works for both bench and pitch players.
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  // The slot currently under an active drag pointer (drag feedback only).
  const [overSlotId, setOverSlotId] = useState<string | null>(null);

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

  const benchPlayers = useMemo(() => {
    const unordered = pitchPlayers.filter((player) => !player.isStarter);
    const orderIndex = new Map(benchOrder.map((id, index) => [id, index]));
    return [...unordered].sort((a, b) => {
      const aIndex = orderIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bIndex = orderIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return aIndex - bIndex;
    });
  }, [pitchPlayers, benchOrder]);

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

  const selectedPitchPlayer = selectedPlayerId
    ? playerById[selectedPlayerId] ?? null
    : null;
  const selectedLineupPlayer = selectedPitchPlayer
    ? lineupPlayerById[selectedPitchPlayer.playerId] ?? null
    : null;

  // Can this player legally land in this slot? Drives both tap-to-place and the
  // drag target highlighting, so it takes the player id explicitly.
  const canPlaceInSlot = useCallback(
    (playerId: string | null, slotId: string): boolean => {
      if (!playerId) {
        return false;
      }
      const player = playerById[playerId];
      const slot = slotById[slotId];
      if (!player || !slot || slot.sport !== player.sport) {
        return false;
      }

      const occupant = slot.player;
      if (occupant) {
        // Own slot (no-op) is always "eligible"; otherwise only a bench
        // player can legally substitute into an occupied slot — starter-onto
        // -starter isn't a supported gesture (row order is auto-derived).
        if (occupant.id === player.id) {
          return true;
        }
        if (player.isStarter) {
          return false;
        }
        const nextStarterIds = new Set(
          pitchPlayers.filter((p) => p.isStarter).map((p) => p.id),
        );
        nextStarterIds.delete(occupant.id);
        nextStarterIds.add(player.id);
        const nextStarters = pitchPlayers.filter((p) => nextStarterIds.has(p.id));
        return validateNextStarters(nextStarters, layout.mode).ok;
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
      activeSportCounts,
      isMultiSport,
      layout.mode,
      pitchPlayers,
      playerById,
      slotById,
      starterLimitReached,
    ],
  );

  // The single source of substitution truth, shared by drag-drop and
  // tap-to-place. Returns whether the substitution was applied. A slot's
  // occupant is `slot.player` directly — rows are already built from the
  // current starters' real positions, so there's no separate occupancy to
  // resolve (unlike the old free-form coordinate system).
  const commitSubstitution = useCallback(
    (dragged: PitchPlayer, slot: FormationSlot<PitchPlayer>): boolean => {
      if (slot.sport !== dragged.sport) {
        triggerShake(slot.id);
        toastifier.error(`This is a ${slot.sport} slot.`);
        return false;
      }

      const occupant = slot.player;

      // No-op: dropped back onto the player's own slot.
      if (occupant?.id === dragged.id) {
        return true;
      }

      // ── Occupied slot → substitution (bench → starter) ──
      if (occupant) {
        if (dragged.isStarter) {
          // Starter-onto-starter isn't a supported gesture: row order is
          // auto-derived and meaningless, and neither is FPL's own pitch.
          toastifier.info(`${dragged.name} is already in your starting lineup.`);
          return false;
        }

        const nextStarterIds = new Set(
          pitchPlayers.filter((p) => p.isStarter).map((p) => p.id),
        );
        nextStarterIds.delete(occupant.id);
        nextStarterIds.add(dragged.id);
        const nextStarters = pitchPlayers.filter((p) => nextStarterIds.has(p.id));

        const validation = validateNextStarters(nextStarters, layout.mode);
        if (!validation.ok) {
          triggerShake(slot.id);
          toastifier.error(validation.reason);
          return false;
        }

        onSwapStarter(dragged.playerId, occupant.playerId);
        toastifier.info(`${dragged.name} ↔ ${occupant.name}`);
        return true;
      }

      // ── Empty slot (floor-padding, or an incomplete XI) ──
      if (!dragged.isStarter) {
        if (starterLimitReached) {
          triggerShake(slot.id);
          toastifier.error("Starter limit reached.");
          return false;
        }
        if (isMultiSport) {
          const limit =
            MULTISPORT_STARTER_REQUIREMENTS[
              dragged.sport as keyof typeof MULTISPORT_STARTER_REQUIREMENTS
            ] ?? 0;
          if ((activeSportCounts[dragged.sport] ?? 0) >= limit) {
            triggerShake(slot.id);
            toastifier.error(`Limit: ${limit} ${dragged.sport} players.`);
            return false;
          }
        }
        onToggleStarter(dragged.playerId);
        toastifier.info(`${dragged.name} added to lineup.`);
      }
      return true;
    },
    [
      activeSportCounts,
      isMultiSport,
      layout.mode,
      onSwapStarter,
      onToggleStarter,
      pitchPlayers,
      starterLimitReached,
      triggerShake,
    ],
  );

  // Direct single-sided bench (drag-to-bench-zone or the "Move to Bench"
  // button): intentionally NOT bounds-checked, so a user can freely
  // reorganize across two steps (bench one player, then add another) without
  // getting blocked mid-sequence — the final XI is still gated at Save time.
  const benchPlayer = useCallback(
    (playerId: string) => {
      const player = playerById[playerId];
      if (!player) {
        return;
      }
      if (player.isStarter) {
        onToggleStarter(player.playerId);
        toastifier.info(`${player.name} moved to bench`);
      }
      setSelectedPlayerId(null);
    },
    [onToggleStarter, playerById],
  );

  const handleRemoveFromSlot = useCallback(
    (slotId: string) => {
      const playerId = slotById[slotId]?.player?.id;
      if (playerId) {
        benchPlayer(playerId);
      }
    },
    [benchPlayer, slotById],
  );

  // Tap a slot: with a player selected, place/swap/substitute; otherwise select
  // the slot's occupant. Tapping the selected player's own slot deselects.
  const handleSlotTap = useCallback(
    (slotId: string) => {
      if (disabled) {
        return;
      }
      const slot = slotById[slotId];
      if (!slot) {
        return;
      }
      const occupantId = slot.player?.id ?? null;

      if (!selectedPlayerId) {
        if (occupantId) {
          setSelectedPlayerId(occupantId);
        }
        return;
      }

      if (occupantId === selectedPlayerId) {
        setSelectedPlayerId(null);
        return;
      }

      const dragged = playerById[selectedPlayerId];
      if (!dragged) {
        setSelectedPlayerId(null);
        return;
      }
      if (commitSubstitution(dragged, slot)) {
        setSelectedPlayerId(dragged.id);
      }
    },
    [commitSubstitution, disabled, playerById, selectedPlayerId, slotById],
  );

  const handlePlayerTap = useCallback(
    (playerId: string) => {
      if (disabled) {
        return;
      }
      setSelectedPlayerId((prev) => (prev === playerId ? null : playerId));
    },
    [disabled],
  );

  // Drop a selected bench player into the first open eligible slot.
  const handleAutoPlace = useCallback(
    (playerId: string) => {
      const player = playerById[playerId];
      if (!player) {
        return;
      }
      const target = slots.find(
        (slot) =>
          slot.sport === player.sport &&
          !slot.player &&
          canPlaceInSlot(playerId, slot.id),
      );
      if (!target) {
        toastifier.info("No open slot — tap a player on the pitch to swap.");
        return;
      }
      if (commitSubstitution(player, target)) {
        setSelectedPlayerId(player.id);
      }
    },
    [canPlaceInSlot, commitSubstitution, playerById, slots],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const dragData = event.active.data.current;
    if (dragData?.type === "player") {
      setActiveDragPlayerId(String(dragData.playerId));
    }
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over?.id;
    setOverSlotId(
      typeof overId === "string" && overId.startsWith("slot-")
        ? overId.replace("slot-", "")
        : null,
    );
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragPlayerId(null);
      setOverSlotId(null);

      const dragData = event.active.data.current;
      if (!dragData || dragData.type !== "player") {
        return;
      }
      const dragged = playerById[String(dragData.playerId)];
      if (!dragged) {
        return;
      }

      const overId = event.over?.id;

      // Explicit bench drop → bench the starter.
      if (overId === "bench-drop") {
        benchPlayer(dragged.id);
        return;
      }

      // Dropped onto a bench card (only bench cards use this id scheme —
      // pitch slots use "slot-…"): a starter lands here to bench them (same
      // as the explicit drop zone, just a bigger/more natural target); a
      // bench player lands here to reorder bench priority.
      if (typeof overId === "string" && overId.startsWith("player-")) {
        const targetPlayerId = overId.replace("player-", "");
        if (targetPlayerId === dragged.id) {
          return;
        }
        if (dragged.isStarter) {
          benchPlayer(dragged.id);
          return;
        }
        const targetPlayer = playerById[targetPlayerId];
        if (targetPlayer && !targetPlayer.isStarter) {
          onReorderBench(dragged.id, targetPlayerId);
        }
        return;
      }

      // Dropped on nothing → cancel (never bench by accident).
      if (typeof overId !== "string" || !overId.startsWith("slot-")) {
        return;
      }
      const slot = slotById[overId.replace("slot-", "")];
      if (!slot) {
        return;
      }
      if (commitSubstitution(dragged, slot)) {
        setSelectedPlayerId(dragged.id);
      }
    },
    [benchPlayer, commitSubstitution, onReorderBench, playerById, slotById],
  );

  const handleDragCancel = useCallback(() => {
    setActiveDragPlayerId(null);
    setOverSlotId(null);
  }, []);

  // The player currently driving target highlighting (drag wins over tap).
  const interactionPlayerId = activeDragPlayerId ?? selectedPlayerId;
  const isDragging = activeDragPlayerId !== null;

  const playerFromDragId = useCallback(
    (id: UniqueIdentifier | undefined): PitchPlayer | null => {
      if (typeof id !== "string" || !id.startsWith("player-")) {
        return null;
      }
      return playerById[id.replace("player-", "")] ?? null;
    },
    [playerById],
  );

  const announcements = useMemo<Announcements>(
    () => ({
      onDragStart({ active }) {
        const player = playerFromDragId(active.id);
        return player ? `Picked up ${player.name}.` : "Picked up player.";
      },
      onDragOver({ active, over }) {
        const player = playerFromDragId(active.id);
        if (!player) {
          return undefined;
        }
        if (!over) {
          return `${player.name} is not over a drop zone.`;
        }
        if (over.id === "bench-drop") {
          return `${player.name} is over the bench.`;
        }
        if (typeof over.id === "string" && over.id.startsWith("slot-")) {
          const slot = slotById[over.id.replace("slot-", "")];
          if (slot) {
            return `${player.name} is over the ${slot.label} slot.`;
          }
        }
        return undefined;
      },
      onDragEnd({ active, over }) {
        const player = playerFromDragId(active.id);
        if (!player) {
          return undefined;
        }
        if (over?.id === "bench-drop") {
          return `${player.name} moved to the bench.`;
        }
        if (typeof over?.id === "string" && over.id.startsWith("slot-")) {
          const slot = slotById[over.id.replace("slot-", "")];
          if (slot) {
            return `${player.name} placed in the ${slot.label} slot.`;
          }
        }
        return `${player.name} was dropped.`;
      },
      onDragCancel({ active }) {
        const player = playerFromDragId(active.id);
        return player
          ? `Movement cancelled. ${player.name} returned.`
          : "Movement cancelled.";
      },
    }),
    [playerFromDragId, slotById],
  );

  const activeDragPlayer = activeDragPlayerId
    ? playerById[activeDragPlayerId]
    : null;

  return (
    <div className="space-y-6">
      <DndContext
        sensors={sensors}
        accessibility={{ announcements }}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
          <section className="space-y-4 rounded-[3px] border border-white/8 bg-surface-1 p-4">
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
                      onTap={handlePlayerTap}
                    />
                  ))}
                </SortableContext>
              )}
            </DropZone>
          </section>

          <section className="mx-auto w-full max-w-2xl animate-[fade-soft_0.2s_ease]">
            {isMultiSport ? (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-[3px] sport-badge-basketball px-3 py-1 font-barlow-condensed text-xs font-700 uppercase tracking-[1px] tabular-nums">
                  Basketball {activeSportCounts.basketball ?? 0} /{" "}
                  {MULTISPORT_STARTER_REQUIREMENTS.basketball}
                </span>
                <span className="rounded-[3px] sport-badge-football px-3 py-1 font-barlow-condensed text-xs font-700 uppercase tracking-[1px] tabular-nums">
                  Football {activeSportCounts.football ?? 0} /{" "}
                  {MULTISPORT_STARTER_REQUIREMENTS.football}
                </span>
              </div>
            ) : null}

            <FormationRenderer
              layout={layout}
              renderSlot={({ slot }) => {
                const player = slot.player;
                const lineupPlayer = player
                  ? lineupPlayerById[player.playerId]
                  : null;
                const isEligible =
                  interactionPlayerId !== null &&
                  canPlaceInSlot(interactionPlayerId, slot.id);
                const isHoveredTarget = isDragging && overSlotId === slot.id;

                return (
                  <PitchSlotMarker
                    slot={slot}
                    player={player}
                    isDropDisabled={
                      disabled ||
                      (isDragging && !canPlaceInSlot(activeDragPlayerId, slot.id))
                    }
                    isEligible={isEligible}
                    isHoveredTarget={isHoveredTarget}
                    isDimmed={isDragging && !isEligible}
                    isDisplaced={
                      isHoveredTarget &&
                      isEligible &&
                      !!player &&
                      player.id !== activeDragPlayerId
                    }
                    isShaking={shakeSlotId === slot.id}
                    isSelected={!!player && selectedPlayerId === player.id}
                    isCaptain={!!lineupPlayer?.isCaptain}
                    isViceCaptain={!!lineupPlayer?.isViceCaptain}
                    onRemove={handleRemoveFromSlot}
                    onSlotTap={handleSlotTap}
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

      <section className="space-y-4 rounded-[3px] border border-white/8 bg-surface-1 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="section-label">Selected Player</p>
          {selectedPitchPlayer ? (
            <button
              type="button"
              onClick={() => setSelectedPlayerId(null)}
              className="inline-flex items-center gap-1 rounded-[3px] border border-white/8 px-2.5 py-1 font-barlow-condensed text-[11px] font-700 uppercase tracking-[1px] text-fg-3 transition-colors hover:text-fg-1"
            >
              <X size={12} />
              Deselect
            </button>
          ) : (
            <span className="rounded-[3px] border border-white/8 bg-surface-2 px-3 py-1 font-barlow-condensed text-[11px] font-700 uppercase tracking-[1px] text-fg-3">
              Tap a player to move or assign C/VC
            </span>
          )}
        </div>

        {!selectedPitchPlayer || !selectedLineupPlayer ? (
          <div className="rounded-[3px] border border-dashed border-white/8 bg-surface-2 p-6 text-center font-barlow-condensed text-sm font-700 uppercase tracking-[1px] text-fg-3">
            Tap a player on the pitch or bench, then tap a slot to move them — or
            assign captain below.
          </div>
        ) : (
          <div className="space-y-4 rounded-[3px] border border-white/8 bg-surface-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-barlow-condensed text-base font-700 uppercase tracking-[0.5px] text-fg-1">
                  {selectedLineupPlayer.name}
                </p>
                <p className="mt-1 text-xs text-fg-3">
                  {selectedLineupPlayer.position} · {selectedLineupPlayer.realTeam}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-[3px] px-2 py-0.5 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1px] ${
                  selectedPitchPlayer.isStarter
                    ? "sport-badge-football"
                    : "border border-white/8 text-fg-3"
                }`}
              >
                {selectedPitchPlayer.isStarter ? "Starting" : "Bench"}
              </span>
            </div>

            {selectedPitchPlayer.isStarter ? (
              <>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onSetCaptain(selectedLineupPlayer.playerId)}
                    disabled={disabled || selectedLineupPlayer.isViceCaptain}
                    className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-[3px] border px-3 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[1px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      selectedLineupPlayer.isCaptain
                        ? "border-yellow-400 bg-yellow-400 text-yellow-950"
                        : "border-white/8 text-fg-2 hover:text-fg-1"
                    }`}
                  >
                    <Crown size={14} />
                    Captain
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onSetViceCaptain(selectedLineupPlayer.playerId)
                    }
                    disabled={disabled || selectedLineupPlayer.isCaptain}
                    className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-[3px] border px-3 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[1px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      selectedLineupPlayer.isViceCaptain
                        ? "border-sky-400 bg-sky-400 text-sky-950"
                        : "border-white/8 text-fg-2 hover:text-fg-1"
                    }`}
                  >
                    <Shield size={14} />
                    Vice
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => benchPlayer(selectedPitchPlayer.id)}
                  disabled={disabled}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-[3px] border border-[rgba(255,59,48,0.3)] px-3 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-[#ff3b30] transition-colors hover:bg-[rgba(255,59,48,0.08)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowDownToLine size={14} />
                  Move to Bench
                </button>
              </>
            ) : (
              <>
                <p className="text-xs text-fg-3">
                  On your bench. Tap a highlighted slot on the pitch to add them,
                  or:
                </p>
                <button
                  type="button"
                  onClick={() => handleAutoPlace(selectedPitchPlayer.id)}
                  disabled={disabled}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-[3px] bg-accent px-3 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-black transition-colors hover:bg-accent-bright disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-fg-3"
                >
                  <Plus size={14} />
                  Add to Lineup
                </button>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDownToLine, Crown, Plus, Shield, X } from "lucide-react";
import { PitchSlot, PlayerChip } from "./PitchSlot";
import { BenchList } from "./BenchList";
import { MULTISPORT_STARTER_REQUIREMENTS, type PitchPlayer } from "./pitchPlayer";
import type { LineupPlayerCardModel } from "../hooks/useLeagueLineupData";
import { FormationRenderer } from "@/components/dashboard/shared/formation/FormationRenderer";
import {
  buildTeamLayout,
  isFootballGoalkeeper,
  validateFootballFormation,
  type FormationSlot,
  type TeamLayout,
} from "@/components/dashboard/shared/formation/formationEngine";
import { toastifier } from "@/lib/toastifier";

type LineupPitchViewProps = {
  allPlayers: LineupPlayerCardModel[];
  /** Bench priority order (player ids); drives auto-sub priority server-side. */
  benchOrder: string[];
  onReorderBench: (draggedId: string, targetId: string) => void;
  onToggleStarter: (playerId: string) => void;
  /** Atomic bench↔starter swap — must be used instead of two onToggleStarter
   * calls (see swapStarter's comment in useLineupState.ts for why). */
  onSwapStarter: (benchPlayerId: string, starterPlayerId: string) => void;
  onSetCaptain: (playerId: string) => void;
  onSetViceCaptain: (playerId: string) => void;
  starterLimitReached: boolean;
  disabled?: boolean;
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

  // Screen-reader feedback for the select-then-place keyboard/tap path
  // (mouse drag gets its own narration via the DndContext `announcements`
  // prop below — this region only speaks for taps/keyboard so the two don't
  // double-announce the same move).
  const [liveMessage, setLiveMessage] = useState("");

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
  // This is the keyboard path too — PitchSlot's Enter/Space handler calls the
  // same function a mouse tap does.
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
          const player = playerById[occupantId];
          if (player) {
            setLiveMessage(
              `${player.name} selected. Choose a highlighted slot to place them, or press Escape to cancel.`,
            );
          }
        }
        return;
      }

      if (occupantId === selectedPlayerId) {
        setSelectedPlayerId(null);
        setLiveMessage("Selection cleared.");
        return;
      }

      const dragged = playerById[selectedPlayerId];
      if (!dragged) {
        setSelectedPlayerId(null);
        return;
      }
      const occupant = slot.player;
      if (commitSubstitution(dragged, slot)) {
        setSelectedPlayerId(dragged.id);
        setLiveMessage(
          occupant
            ? `${dragged.name} swapped with ${occupant.name}.`
            : `${dragged.name} placed in the ${slot.label} slot.`,
        );
      }
    },
    [commitSubstitution, disabled, playerById, selectedPlayerId, slotById],
  );

  const handlePlayerTap = useCallback(
    (playerId: string) => {
      if (disabled) {
        return;
      }
      setSelectedPlayerId((prev) => {
        const next = prev === playerId ? null : playerId;
        const player = playerById[playerId];
        if (player) {
          setLiveMessage(
            next
              ? `${player.name} selected. Choose a highlighted slot to place them, or press Escape to cancel.`
              : `${player.name} deselected.`,
          );
        }
        return next;
      });
    },
    [disabled, playerById],
  );

  // Escape cancels the current select-then-place selection from anywhere in
  // the pitch view (bubbles up from whichever slot/bench card has focus).
  const handleContainerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape" && selectedPlayerId) {
        setSelectedPlayerId(null);
        setLiveMessage("Selection cleared.");
      }
    },
    [selectedPlayerId],
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
        setLiveMessage(`${player.name} placed in the ${target.label} slot.`);
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
    <div className="space-y-6" onKeyDown={handleContainerKeyDown}>
      <div aria-live="polite" className="sr-only">
        {liveMessage}
      </div>

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
          <BenchList
            benchPlayers={benchPlayers}
            selectedPlayerId={selectedPlayerId}
            onTap={handlePlayerTap}
          />

          <section className="mx-auto w-full max-w-2xl animate-[fade-soft_0.2s_ease]">
            {isMultiSport ? (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-[3px] sport-badge-basketball px-3 py-1 font-sans text-xs font-700 uppercase tracking-[1px] tabular-nums">
                  Basketball {activeSportCounts.basketball ?? 0} /{" "}
                  {MULTISPORT_STARTER_REQUIREMENTS.basketball}
                </span>
                <span className="rounded-[3px] sport-badge-football px-3 py-1 font-sans text-xs font-700 uppercase tracking-[1px] tabular-nums">
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
                  <PitchSlot
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

      <section className="space-y-4 card-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="section-label">Selected Player</p>
          {selectedPitchPlayer ? (
            <button
              type="button"
              onClick={() => setSelectedPlayerId(null)}
              className="inline-flex items-center gap-1 rounded-[3px] border border-white/8 px-2.5 py-1 font-sans text-[11px] font-700 uppercase tracking-[1px] text-fg-3 transition-colors hover:text-fg-1"
            >
              <X size={12} />
              Deselect
            </button>
          ) : (
            <span className="rounded-[3px] border border-white/8 bg-surface-2 px-3 py-1 font-sans text-[11px] font-700 uppercase tracking-[1px] text-fg-3">
              Tap a player to move or assign C/VC
            </span>
          )}
        </div>

        {!selectedPitchPlayer || !selectedLineupPlayer ? (
          <div className="rounded-[3px] border border-dashed border-white/8 bg-surface-2 p-6 text-center font-sans text-sm font-700 uppercase tracking-[1px] text-fg-3">
            Tap a player on the pitch or bench, then tap a slot to move them — or
            assign captain below.
          </div>
        ) : (
          <div className="space-y-4 rounded-[3px] border border-white/8 bg-surface-2 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-sans text-base font-700 uppercase tracking-[0.5px] text-fg-1">
                  {selectedLineupPlayer.name}
                </p>
                <p className="mt-1 text-xs text-fg-3">
                  {selectedLineupPlayer.position} · {selectedLineupPlayer.realTeam}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-[3px] px-2 py-0.5 font-sans text-[10px] font-700 uppercase tracking-[1px] ${
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
                    className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-[3px] border px-3 py-2 font-sans text-xs font-700 uppercase tracking-[1px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
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
                    className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-[3px] border px-3 py-2 font-sans text-xs font-700 uppercase tracking-[1px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
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
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-[3px] border border-[rgba(255,59,48,0.3)] px-3 py-2 font-sans text-xs font-700 uppercase tracking-[1px] text-danger transition-colors hover:bg-[rgba(255,59,48,0.08)] disabled:cursor-not-allowed disabled:opacity-50"
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
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-[3px] bg-accent px-3 py-2 font-sans text-xs font-700 uppercase tracking-[1.5px] text-black transition-colors hover:bg-accent-bright disabled:cursor-not-allowed disabled:bg-surface-3 disabled:text-fg-3"
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

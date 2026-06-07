"use client";
/* eslint-disable react-hooks/refs */

import { useEffect, useMemo, useState, useRef } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { DropZone } from "@/components/dashboard/leagues/league-roster/components/DropZone";
import type { LineupPlayerCardModel } from "@/components/dashboard/leagues/league-lineup/hooks/useLeagueLineupData";
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
  team: string;
  points: number | null;
  isStarter: boolean;
};

const MULTISPORT_STARTER_REQUIREMENTS = {
  football: 5,
  basketball: 4,
} as const;

type PitchSlotMarkerProps = {
  slot: FormationSlot<PitchPlayer>;
  player: PitchPlayer | null;
  isSelected: boolean;
  isDropDisabled: boolean;
  isCaptain: boolean;
  isViceCaptain: boolean;
  onRemove: (slotId: string) => void;
  onSelectPlayer: (playerId: string) => void;
};

function PitchSlotMarker({
  slot,
  player,
  isSelected,
  isDropDisabled,
  isCaptain,
  isViceCaptain,
  onRemove,
  onSelectPlayer,
}: PitchSlotMarkerProps) {
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
        opacity: draggable.isDragging ? 0.4 : 1,
        zIndex: draggable.isDragging ? 50 : 10,
      }
    : undefined;

  return (
    <DropZone
      id={`slot-${slot.id}`}
      disabled={isDropDisabled}
      className="group relative h-20 w-20 sm:h-24 sm:w-24"
      activeClassName="scale-110 !z-30"
    >
      <div
        ref={player ? draggable.setNodeRef : undefined}
        style={style}
        {...(player ? draggable.listeners : undefined)}
        {...(player ? draggable.attributes : undefined)}
        onClick={() => {
          if (player) {
            onSelectPlayer(player.id);
          }
        }}
        className={`relative flex flex-col items-center justify-center transition-all duration-200 ${
          player
            ? `cursor-grab p-1 ${isSelected ? "rounded-[3px] ring-2 ring-white/40 ring-offset-2 ring-offset-green-900/40" : ""}`
            : "h-12 w-12 rounded-[3px] border border-dashed border-white/20 bg-[#1d1d26] backdrop-blur-[2px] hover:bg-[#1d1d26]"
        } ${draggable.isDragging ? "shadow-2xl" : ""}`}
      >
        {player ? (
          <div className="relative">
            {/* Player Container */}
            <div className="relative">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-[3px] border border-white/25 bg-white shadow-lg sm:h-14 sm:w-14 ${isSelected ? "ring-2 ring-accent-primary" : ""}`}
              >
                <span className="text-xl">{getSportIcon(player.sport)}</span>
              </div>

              {/* Status Badges */}
              {isCaptain ? (
                <div className="absolute -left-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-[3px] bg-yellow-400 text-[10px] font-700 text-yellow-950 shadow-sm ring-2 ring-white/10">
                  C
                </div>
              ) : isViceCaptain ? (
                <div className="absolute -left-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-[3px] bg-sky-400 text-[10px] font-700 text-sky-950 shadow-sm ring-2 ring-white/10">
                  VC
                </div>
              ) : null}

              {/* Points/Sport Overlay */}
              <div
                className={`absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-[3px] border text-[9px] font-700 shadow-sm ring-2 ring-white/10 ${getSportAccentClass(player.sport)}`}
              >
                {typeof player.points === "number" ? player.points : "0"}
              </div>
            </div>

            {/* Remove Action Button */}
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

            {/* Name/Label */}
            <div className="absolute top-[calc(100%+6px)] left-1/2 -translate-x-1/2 text-center">
              <p className="w-20 truncate rounded bg-black/50 px-1 py-0.5 text-[10px] font-700 text-white backdrop-blur-xs">
                {player.name}
              </p>
              <p className="mt-0.5 text-[9px] uppercase tracking-[2px]er text-white/80">
                {player.position}
              </p>
            </div>
          </div>
        ) : (
          <div className="pointer-events-none flex flex-col items-center">
            <span className="text-[9px] font-700 uppercase text-white/40">
              {slot.label}
            </span>
          </div>
        )}
      </div>
    </DropZone>
  );
}

type DraggableBenchPlayerCardProps = {
  player: PitchPlayer;
};

function DraggableBenchPlayerCard({ player }: DraggableBenchPlayerCardProps) {
  const draggable = useDraggable({
    id: `player-${player.id}`,
    data: {
      type: "player",
      playerId: player.id,
      from: "bench",
    },
  });

  const style = {
    transform: CSS.Translate.toString(draggable.transform),
    opacity: draggable.isDragging ? 0.45 : 1,
  };

  return (
    <article
      ref={draggable.setNodeRef}
      style={style}
      {...draggable.listeners}
      {...draggable.attributes}
      className="cursor-grab rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-3 transition hover:bg-[#1d1d26] hover:shadow-[0_16px_44px_rgba(0,0,0,0.28)]"
      title={`${player.name} | ${player.position} | ${player.realTeam} | Cost ${player.cost}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-600 text-[#f0f0f0]">
          {player.name}
        </p>
        <span className="text-base" aria-label={player.sport}>
          {getSportIcon(player.sport)}
        </span>
      </div>
      <p className="mt-1 text-xs text-[#555560]">{player.position}</p>
      <p className="mt-1 truncate text-xs text-[#555560]">
        {player.realTeam}
      </p>
      <p className="mt-1 text-xs text-[#e8fb25]">
        Cost {player.cost}
      </p>
    </article>
  );
}

export function LineupPitchView({
  allPlayers,
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
        team: player.realTeam,
        points: null,
        isStarter: player.isStarter,
      })),
    [allPlayers],
  );

  const layout = useMemo(
    () => buildTeamLayout(pitchPlayers, { activeOnly: true }),
    [pitchPlayers],
  );

  const slotMetaById = useMemo(
    () =>
      layout.sections.reduce<Record<string, FormationSlot<PitchPlayer>>>(
        (acc, section) => {
          section.slots.forEach((slot) => {
            acc[slot.id] = slot;
          });
          return acc;
        },
        {},
      ),
    [layout],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const [slotToPlayer, setSlotToPlayer] = useState<
    Record<string, string | null>
  >({});
  const slotToPlayerRef = useRef(slotToPlayer);

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
      allPlayers.reduce<Record<string, LineupPlayerCardModel>>(
        (acc, player) => {
          acc[player.playerId] = player;
          return acc;
        },
        {},
      ),
    [allPlayers],
  );

  const isMultiSport = layout.mode === "mixed";

  const [activeDragPlayerId, setActiveDragPlayerId] = useState<string | null>(
    null,
  );
  const [selectedPitchPlayerId, setSelectedPitchPlayerId] = useState<
    string | null
  >(null);

  // Sync layout changes to local slot mapping state
  useEffect(() => {
    const nextSlots: Record<string, string | null> = {};

    layout.sections.forEach((section) => {
      section.slots.forEach((slot) => {
        nextSlots[slot.id] = slot.player ? slot.player.id : null;
      });
    });

    const nextSlotsString = JSON.stringify(nextSlots);
    const currentSlotsString = JSON.stringify(slotToPlayerRef.current);

    if (nextSlotsString !== currentSlotsString) {
      slotToPlayerRef.current = nextSlots;
      setSlotToPlayer(nextSlots);
    }
  }, [layout]);

  const benchPlayers = useMemo(
    () =>
      pitchPlayers.filter((player) => {
        const lineupPlayer = lineupPlayerById[player.playerId];
        return !lineupPlayer?.isStarter;
      }),
    [pitchPlayers, lineupPlayerById],
  );

  const activePlayers = useMemo(
    () => pitchPlayers.filter((p) => p.isStarter),
    [pitchPlayers],
  );

  const activeSportCounts = useMemo(
    () =>
      activePlayers.reduce<Record<string, number>>((acc, player) => {
        acc[player.sport] = (acc[player.sport] ?? 0) + 1;
        return acc;
      }, {}),
    [activePlayers],
  );

  const renderedLayout = layout;

  const selectedPitchPlayer = useMemo(() => {
    if (!selectedPitchPlayerId) {
      return null;
    }
    return playerById[selectedPitchPlayerId] ?? null;
  }, [playerById, selectedPitchPlayerId]);

  const selectedLineupPlayer = useMemo(() => {
    if (!selectedPitchPlayer) {
      return null;
    }
    return lineupPlayerById[selectedPitchPlayer.playerId] ?? null;
  }, [lineupPlayerById, selectedPitchPlayer]);

  const canDropToSlot = (slotId: string): boolean => {
    if (activeDragPlayerId === null) {
      return true;
    }

    const player = playerById[activeDragPlayerId];
    if (!player) {
      return false;
    }

    const slot = slotMetaById[slotId];
    if (!slot || slot.sport !== player.sport) {
      return false;
    }

    const occupant = slotToPlayer[slotId];
    if (occupant && occupant !== player.id) {
      return false;
    }

    if (starterLimitReached && !player.isStarter) {
      return false;
    }

    return true;
  };

  const handleRemoveFromSlot = (slotId: string) => {
    const playerId = slotToPlayer[slotId];
    if (playerId) {
      const removedPlayer = playerById[playerId];
      if (removedPlayer?.isStarter) {
        onToggleStarter(removedPlayer.playerId);
      }
      if (selectedPitchPlayerId === playerId) {
        setSelectedPitchPlayerId(null);
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const dragData = event.active.data.current;
    if (!dragData || dragData.type !== "player") {
      return;
    }

    const playerId = String(dragData.playerId);
    const player = playerById[playerId];
    if (!player) {
      return;
    }

    const overId = event.over?.id;

    // Handle dropping back to bench
    if (!overId || overId === "bench-drop") {
      if (player.isStarter) {
        onToggleStarter(player.playerId);
        toastifier.info(`${player.name} moved to bench`);
      }
      setSelectedPitchPlayerId(null);
      return;
    }

    if (typeof overId !== "string" || !overId.startsWith("slot-")) {
      return;
    }

    const targetSlotId = overId.replace("slot-", "");
    const targetSlot = slotMetaById[targetSlotId];

    if (!targetSlot) {
      return;
    }

    // Sport Validation
    if (targetSlot.sport !== player.sport) {
      toastifier.error(`This is a ${targetSlot.sport} slot!`);
      return;
    }

    // Occupant Logic
    const occupiedPlayerId = slotToPlayer[targetSlotId];
    if (occupiedPlayerId && occupiedPlayerId !== playerId) {
      // Swapping starters or just blocked?
      // Logic: For now, block if occupied to keep it simple, or we could toggle both.
      toastifier.error("Slot already occupied");
      return;
    }

    // Starter Limit Validation
    if (!player.isStarter && starterLimitReached) {
      toastifier.error("Starter limit reached!");
      return;
    }

    // Multisport Limit Validation
    if (isMultiSport && !player.isStarter) {
      const countInSport = activePlayers.filter(
        (p) => p.sport === player.sport,
      ).length;
      const sportLimit =
        player.sport === "football"
          ? MULTISPORT_STARTER_REQUIREMENTS.football
          : player.sport === "basketball"
            ? MULTISPORT_STARTER_REQUIREMENTS.basketball
            : 0;

      if (countInSport >= sportLimit) {
        toastifier.error(`Limit: ${sportLimit} ${player.sport} players`);
        return;
      }
    }

    // Success: Toggle starter state in the parent
    if (!player.isStarter) {
      onToggleStarter(player.playerId);
    }

    setSelectedPitchPlayerId(player.id);
  };

  return (
    <div className="space-y-6">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(event) => {
          const dragData = event.active.data.current;
          if (dragData?.type === "player") {
            setActiveDragPlayerId(String(dragData.playerId));
          }
        }}
        onDragEnd={(event) => {
          handleDragEnd(event);
          setActiveDragPlayerId(null);
        }}
        onDragCancel={() => {
          setActiveDragPlayerId(null);
        }}
      >
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
          <section className="space-y-4 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4 ">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-600 text-[#f0f0f0]">
                Bench Players
              </h3>
              <p className="text-xs text-[#555560]">Drag to pitch</p>
            </div>

            <div className="max-h-155 space-y-2 overflow-y-auto pr-1">
              {benchPlayers.length === 0 ? (
                <p className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-3 text-sm text-[#555560]">
                  No bench players.
                </p>
              ) : (
                benchPlayers.map((player) => (
                  <DraggableBenchPlayerCard key={player.id} player={player} />
                ))
              )}
            </div>
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
              layout={renderedLayout}
              showSectionLabels={isMultiSport}
              renderSlot={({ slot }) => {
                const player = slot.player ?? null;
                const lineupPlayer = player
                  ? lineupPlayerById[player.playerId]
                  : null;

                return (
                  <PitchSlotMarker
                    slot={slot}
                    player={player}
                    isDropDisabled={!canDropToSlot(slot.id)}
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

        <DragOverlay>
          {activeDragPlayerId && playerById[activeDragPlayerId] ? (
            <div className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] px-3 py-2">
              <p className="text-sm text-[#f0f0f0]">
                {playerById[activeDragPlayerId].name}
              </p>
              <p className="text-xs text-[#555560]">
                {playerById[activeDragPlayerId].position}
              </p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <section className="space-y-4 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-5 ">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-600 text-[#f0f0f0]">
            Captain Assignment
          </h3>
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
                  onChange={() =>
                    onSetViceCaptain(selectedLineupPlayer.playerId)
                  }
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

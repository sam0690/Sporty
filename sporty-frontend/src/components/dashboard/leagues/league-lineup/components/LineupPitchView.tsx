"use client";
/* eslint-disable react-hooks/refs */

import { useEffect, useMemo, useState } from "react";
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
import { toastifier } from "@/libs/toastifier";

type LineupPitchViewProps = {
  allPlayers: LineupPlayerCardModel[];
  onToggleStarter: (playerId: string) => void;
  onSetCaptain: (playerId: string) => void;
  onSetViceCaptain: (playerId: string) => void;
  starterLimitReached: boolean;
  disabled?: boolean;
};

type PitchPlayer = {
  id: number;
  playerId: string;
  name: string;
  sport: "football" | "basketball" | "cricket";
  position: string;
  realTeam: string;
  cost: string;
  totalPoints: number;
  avgPoints: number;
  isStarter: boolean;
};

type PitchMode = "football" | "basketball" | "multisport";

const MULTISPORT_STARTER_REQUIREMENTS = {
  football: 5,
  basketball: 4,
} as const;

type SlotConfig = {
  id: number;
  label: string;
  className: string;
};

const SPORT_ALLOWED_SLOTS: Record<PitchPlayer["sport"], number[]> = {
  football: [5, 6, 7, 8, 9],
  basketball: [1, 2, 3, 4],
  cricket: [],
};

const SLOT_CONFIGS: Record<PitchMode, SlotConfig[]> = {
  football: [
    { id: 1, label: "ST", className: "left-[35%] top-[10%]" },
    { id: 2, label: "ST", className: "right-[35%] top-[10%]" },
    { id: 3, label: "LM", className: "left-[15%] top-[30%]" },
    { id: 4, label: "CM", className: "left-[35%] top-[30%]" },
    { id: 5, label: "CM", className: "right-[35%] top-[30%]" },
    { id: 6, label: "RM", className: "right-[15%] top-[30%]" },
    { id: 7, label: "LB", className: "left-[12%] top-[55%]" },
    { id: 8, label: "CB", className: "left-[30%] top-[55%]" },
    { id: 9, label: "CB", className: "right-[30%] top-[55%]" },
    { id: 10, label: "RB", className: "right-[12%] top-[55%]" },
    { id: 11, label: "GK", className: "left-1/2 top-[80%] -translate-x-1/2" },
  ],
  basketball: [
    { id: 1, label: "PG", className: "left-1/2 top-[15%] -translate-x-1/2" },
    { id: 2, label: "SG", className: "left-[25%] top-[30%]" },
    { id: 3, label: "SF", className: "right-[25%] top-[30%]" },
    { id: 4, label: "PF", className: "left-[30%] top-[55%]" },
    { id: 5, label: "C", className: "right-[30%] top-[55%]" },
  ],
  multisport: [
    { id: 1, label: "B1", className: "left-[20%] top-[14%]" },
    { id: 2, label: "B2", className: "right-[20%] top-[14%]" },
    { id: 3, label: "B3", className: "left-[30%] top-[30%]" },
    { id: 4, label: "B4", className: "right-[30%] top-[30%]" },
    { id: 5, label: "F1", className: "left-[15%] top-[52%]" },
    { id: 6, label: "F2", className: "right-[15%] top-[52%]" },
    { id: 7, label: "F3", className: "left-[28%] top-[68%]" },
    { id: 8, label: "F4", className: "right-[28%] top-[68%]" },
    { id: 9, label: "F5", className: "left-1/2 top-[84%] -translate-x-1/2" },
  ],
};

function normalizeSport(value: string): PitchPlayer["sport"] {
  if (value === "football" || value === "basketball" || value === "cricket") {
    return value;
  }
  return "football";
}

const sportIcons: Record<PitchPlayer["sport"], string> = {
  football: "⚽",
  basketball: "🏀",
  cricket: "🏏",
};

const sportAccentClasses: Record<PitchPlayer["sport"], string> = {
  football: "border-green-200 bg-green-50 text-green-700",
  basketball: "border-orange-200 bg-orange-50 text-orange-700",
  cricket: "border-blue-200 bg-blue-50 text-blue-700",
};

function detectPitchMode(players: LineupPlayerCardModel[]): PitchMode {
  const sportSet = new Set(players.map((player) => player.sportName));
  if (sportSet.size > 1) {
    return "multisport";
  }

  const sport = Array.from(sportSet)[0];
  if (sport === "basketball") {
    return "basketball";
  }
  return "football";
}

type PitchSlotMarkerProps = {
  slot: SlotConfig;
  player: PitchPlayer | null;
  isSelected: boolean;
  isDropDisabled: boolean;
  isCaptain: boolean;
  isViceCaptain: boolean;
  onRemove: (slotId: number) => void;
  onSelectPlayer: (playerId: number) => void;
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
        opacity: draggable.isDragging ? 0.5 : 1,
      }
    : undefined;

  return (
    <DropZone
      id={`slot-${slot.id}`}
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
          if (player) {
            onSelectPlayer(player.id);
          }
        }}
        className={`relative flex h-10 w-10 items-center justify-center rounded-full text-center transition-all duration-150 sm:h-14 sm:w-14 ${
          player
            ? `cursor-grab bg-white shadow-md hover:scale-105 hover:shadow-lg ${isSelected ? "outline-2 outline-offset-2 outline-white" : ""}`
            : "border border-dashed border-white/40 bg-white/20 backdrop-blur-sm"
        } ${draggable.isDragging ? "rotate-1 shadow-lg" : ""} ${!isDropDisabled ? "" : "opacity-70"}`}
      >
        {player ? (
          <>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm sm:h-10 sm:w-10">
              {sportIcons[player.sport]}
            </div>
            <span
              className={`absolute -bottom-1 -right-1 rounded-full border px-1 py-0.5 text-[9px] font-semibold leading-none ${sportAccentClasses[player.sport]}`}
            >
              {player.sport === "football"
                ? "F"
                : player.sport === "basketball"
                  ? "B"
                  : "C"}
            </span>
            <div className="pointer-events-none absolute top-[calc(100%+4px)] left-1/2 -translate-x-1/2 text-center">
              <p className="w-20 truncate text-xs font-medium text-white/90">
                {player.name}
              </p>
              <p className="text-[10px] text-white/70">0 pts</p>
            </div>

            {isCaptain ? (
              <span className="absolute -left-1 -top-1 rounded-full border border-yellow-300 bg-yellow-100 px-1 text-[10px] font-bold text-yellow-800">
                C
              </span>
            ) : null}
            {isViceCaptain ? (
              <span className="absolute -right-1 -top-1 rounded-full border border-blue-300 bg-blue-100 px-1 text-[10px] font-bold text-blue-800">
                VC
              </span>
            ) : null}

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
          </>
        ) : (
          <div className="text-xs text-white/80">{slot.label}</div>
        )}
      </div>

      <p className="pointer-events-none absolute top-[calc(100%+4px)] left-1/2 w-16 -translate-x-1/2 text-center text-[10px] font-medium text-white/70">
        {slot.label}
      </p>
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
      className="cursor-grab rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition hover:shadow-md"
      title={`${player.name} | ${player.position} | ${player.realTeam} | Cost ${player.cost}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold text-gray-900">
          {player.name}
        </p>
        <span className="text-base" aria-label={player.sport}>
          {sportIcons[player.sport]}
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-500">{player.position}</p>
      <p className="mt-1 truncate text-xs text-gray-500">{player.realTeam}</p>
      <p className="mt-1 text-xs font-medium text-primary-600">
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
  const pitchMode = useMemo(() => detectPitchMode(allPlayers), [allPlayers]);
  const pitchSlots = useMemo(() => SLOT_CONFIGS[pitchMode], [pitchMode]);
  const allSlotIds = useMemo(
    () => pitchSlots.map((slot) => slot.id),
    [pitchSlots],
  );

  const emptySlots = useMemo(
    () =>
      allSlotIds.reduce<Record<number, number | null>>((acc, id) => {
        acc[id] = null;
        return acc;
      }, {}),
    [allSlotIds],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const [slotToPlayer, setSlotToPlayer] = useState<
    Record<number, number | null>
  >({});
  const [activeDragPlayerId, setActiveDragPlayerId] = useState<number | null>(
    null,
  );
  const [selectedPitchPlayerId, setSelectedPitchPlayerId] = useState<
    number | null
  >(null);

  const pitchPlayers = useMemo<PitchPlayer[]>(
    () =>
      allPlayers.map((player, index) => ({
        id: index + 1,
        playerId: player.playerId,
        name: player.name,
        sport: normalizeSport(player.sportName),
        position: player.position,
        realTeam: player.realTeam,
        cost: player.cost,
        totalPoints: 0,
        avgPoints: 0,
        isStarter: player.isStarter,
      })),
    [allPlayers],
  );

  const playerById = useMemo(
    () =>
      pitchPlayers.reduce<Record<number, PitchPlayer>>((acc, player) => {
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

  const isMultiSport = useMemo(
    () => new Set(pitchPlayers.map((player) => player.sport)).size > 1,
    [pitchPlayers],
  );

  useEffect(() => {
    const nextSlots: Record<number, number | null> = { ...emptySlots };

    if (isMultiSport) {
      const footballPlayers = pitchPlayers
        .filter((player) => player.isStarter && player.sport === "football")
        .slice(0, MULTISPORT_STARTER_REQUIREMENTS.football);
      const basketballPlayers = pitchPlayers
        .filter((player) => player.isStarter && player.sport === "basketball")
        .slice(0, MULTISPORT_STARTER_REQUIREMENTS.basketball);

      const preset: Array<{ slot: number; player: PitchPlayer | undefined }> = [
        { slot: 1, player: basketballPlayers[0] },
        { slot: 2, player: basketballPlayers[1] },
        { slot: 3, player: basketballPlayers[2] },
        { slot: 4, player: basketballPlayers[3] },
        { slot: 5, player: footballPlayers[0] },
        { slot: 6, player: footballPlayers[1] },
        { slot: 7, player: footballPlayers[2] },
        { slot: 8, player: footballPlayers[3] },
        { slot: 9, player: footballPlayers[4] },
      ];

      preset.forEach((item) => {
        nextSlots[item.slot] = item.player ? item.player.id : null;
      });
    } else {
      const startersList = pitchPlayers.filter((player) => player.isStarter);
      startersList.forEach((player, index) => {
        const targetSlot = allSlotIds[index];
        if (targetSlot) {
          nextSlots[targetSlot] = player.id;
        }
      });
    }

    const frame = window.requestAnimationFrame(() => {
      setSlotToPlayer(nextSlots);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pitchPlayers, isMultiSport, emptySlots, allSlotIds]);

  const benchPlayers = useMemo(
    () =>
      pitchPlayers.filter((player) => {
        const lineupPlayer = lineupPlayerById[player.playerId];
        return !lineupPlayer?.isStarter;
      }),
    [pitchPlayers, lineupPlayerById],
  );

  const slotAssignments = useMemo(() => {
    return allSlotIds.reduce<Record<number, PitchPlayer | null>>(
      (acc, slotId) => {
        const playerId = slotToPlayer[slotId];
        acc[slotId] = playerId ? playerById[playerId] : null;
        return acc;
      },
      {},
    );
  }, [slotToPlayer, playerById, allSlotIds]);

  const activePlayers = useMemo(
    () =>
      Object.values(slotAssignments).filter(
        (player): player is PitchPlayer => player !== null,
      ),
    [slotAssignments],
  );

  const activeSportCounts = useMemo(
    () =>
      activePlayers.reduce<Record<string, number>>((acc, player) => {
        acc[player.sport] = (acc[player.sport] ?? 0) + 1;
        return acc;
      }, {}),
    [activePlayers],
  );

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

  const findCurrentSlotOfPlayer = (playerId: number): number | null => {
    const entry = Object.entries(slotToPlayer).find(
      ([, assignedPlayerId]) => assignedPlayerId === playerId,
    );
    return entry ? Number(entry[0]) : null;
  };

  const canPlaceInSlot = (player: PitchPlayer, slotId: number): boolean => {
    if (!isMultiSport) {
      return allSlotIds.includes(slotId);
    }

    const allowed = SPORT_ALLOWED_SLOTS[player.sport];
    return allowed?.includes(slotId) ?? false;
  };

  const canDropToSlot = (slotId: number): boolean => {
    if (activeDragPlayerId === null) {
      return true;
    }

    const player = playerById[activeDragPlayerId];
    if (!player) {
      return false;
    }

    if (!canPlaceInSlot(player, slotId)) {
      return false;
    }

    const occupant = slotToPlayer[slotId];
    if (occupant && occupant !== player.id) {
      return false;
    }

    if (starterLimitReached && !player.isStarter) {
      return false;
    }

    if (!isMultiSport) {
      return true;
    }

    const currentSlot = findCurrentSlotOfPlayer(player.id);
    const countInSport = activePlayers.filter(
      (item) => item.sport === player.sport,
    ).length;
    if (currentSlot !== null) {
      return true;
    }

    const sportLimit =
      player.sport === "football"
        ? MULTISPORT_STARTER_REQUIREMENTS.football
        : player.sport === "basketball"
          ? MULTISPORT_STARTER_REQUIREMENTS.basketball
          : 0;

    return countInSport < sportLimit;
  };

  const handleRemoveFromSlot = (slotId: number) => {
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

    setSlotToPlayer((prev) => ({ ...prev, [slotId]: null }));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const dragData = event.active.data.current;
    if (!dragData || dragData.type !== "player") {
      return;
    }

    const playerId = Number(dragData.playerId);
    const player = playerById[playerId];
    if (!player) {
      return;
    }

    const overId = event.over?.id;
    if (!overId) {
      return;
    }

    if (overId === "bench-drop") {
      const currentSlot = findCurrentSlotOfPlayer(playerId);
      if (currentSlot !== null) {
        setSlotToPlayer((prev) => ({ ...prev, [currentSlot]: null }));
      }
      if (player.isStarter) {
        onToggleStarter(player.playerId);
      }
      if (selectedPitchPlayerId === playerId) {
        setSelectedPitchPlayerId(null);
      }
      return;
    }

    if (typeof overId !== "string" || !overId.startsWith("slot-")) {
      return;
    }

    const targetSlot = Number(overId.replace("slot-", ""));
    if (!allSlotIds.includes(targetSlot)) {
      return;
    }

    if (!canDropToSlot(targetSlot)) {
      if (isMultiSport) {
        const sportLimit =
          player.sport === "football"
            ? MULTISPORT_STARTER_REQUIREMENTS.football
            : player.sport === "basketball"
              ? MULTISPORT_STARTER_REQUIREMENTS.basketball
              : 0;
        toastifier.error(
          `Multisport allows only ${sportLimit} ${player.sport} starters.`,
        );
        return;
      }

      toastifier.error("Cannot place this player in the selected slot");
      return;
    }

    const occupiedPlayerId = slotToPlayer[targetSlot];
    if (occupiedPlayerId && occupiedPlayerId !== playerId) {
      toastifier.error("Slot already occupied");
      return;
    }

    const currentSlot = findCurrentSlotOfPlayer(playerId);
    const nextSlots = { ...slotToPlayer };
    if (currentSlot !== null) {
      nextSlots[currentSlot] = null;
    }
    nextSlots[targetSlot] = playerId;
    setSlotToPlayer(nextSlots);
    setSelectedPitchPlayerId(playerId);

    if (!player.isStarter) {
      onToggleStarter(player.playerId);
    }
  };

  return (
    <div className="space-y-6">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(event) => {
          const dragData = event.active.data.current;
          if (dragData?.type === "player") {
            setActiveDragPlayerId(Number(dragData.playerId));
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
          <section className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-gray-900">
                Bench Players
              </h3>
              <p className="text-xs text-gray-500">Drag to pitch</p>
            </div>

            <div className="max-h-155 space-y-2 overflow-y-auto pr-1">
              {benchPlayers.length === 0 ? (
                <p className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-500">
                  No bench players.
                </p>
              ) : (
                benchPlayers.map((player) => (
                  <DraggableBenchPlayerCard key={player.id} player={player} />
                ))
              )}
            </div>
          </section>

          <section className="w-full max-w-2xl mx-auto animate-[fade-soft_0.2s_ease]">
            {isMultiSport ? (
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 font-medium text-orange-700">
                  🏀 Basketball: {activeSportCounts.basketball ?? 0} /{" "}
                  {MULTISPORT_STARTER_REQUIREMENTS.basketball}
                </span>
                <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 font-medium text-green-700">
                  ⚽ Football: {activeSportCounts.football ?? 0} /{" "}
                  {MULTISPORT_STARTER_REQUIREMENTS.football}
                </span>
              </div>
            ) : null}
            <div className="relative mx-auto aspect-3/4 w-full overflow-hidden rounded-2xl bg-linear-to-b from-[#1a4d2e] to-[#0f3a22] shadow-xl">
              <div className="pointer-events-none absolute left-1/2 top-0 h-[12%] w-[34%] -translate-x-1/2 border border-white/20" />
              <div className="pointer-events-none absolute bottom-0 left-1/2 h-[12%] w-[34%] -translate-x-1/2 border border-white/20" />
              <div className="pointer-events-none absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/20" />
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20 sm:h-24 sm:w-24" />

              {pitchSlots.map((slot) => {
                const player = slotAssignments[slot.id] ?? null;
                const lineupPlayer = player
                  ? lineupPlayerById[player.playerId]
                  : null;

                return (
                  <div key={slot.id} className={`absolute ${slot.className}`}>
                    <PitchSlotMarker
                      slot={slot}
                      player={player}
                      isDropDisabled={!canDropToSlot(slot.id)}
                      isSelected={
                        !!player && selectedPitchPlayerId === player.id
                      }
                      isCaptain={!!lineupPlayer?.isCaptain}
                      isViceCaptain={!!lineupPlayer?.isViceCaptain}
                      onRemove={handleRemoveFromSlot}
                      onSelectPlayer={setSelectedPitchPlayerId}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <DragOverlay>
          {activeDragPlayerId && playerById[activeDragPlayerId] ? (
            <div className="rounded-xl border border-primary-200 bg-white px-3 py-2 shadow-2xl">
              <p className="text-sm font-medium text-gray-900">
                {playerById[activeDragPlayerId].name}
              </p>
              <p className="text-xs text-gray-500">
                {playerById[activeDragPlayerId].position}
              </p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <section className="space-y-4 rounded-2xl border border-gray-100 bg-white p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Captain Assignment
          </h3>
          <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600">
            Click a player on the pitch to assign C/VC
          </span>
        </div>

        {!selectedLineupPlayer ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-500">
            Select a starter on the pitch to assign captain or vice-captain.
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-900">
              {selectedLineupPlayer.name}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {selectedLineupPlayer.position} • {selectedLineupPlayer.realTeam}
            </p>

            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={selectedLineupPlayer.isCaptain}
                  onChange={() => onSetCaptain(selectedLineupPlayer.playerId)}
                  disabled={disabled || selectedLineupPlayer.isViceCaptain}
                  className="h-4 w-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-300"
                />
                Make Captain
              </label>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={selectedLineupPlayer.isViceCaptain}
                  onChange={() =>
                    onSetViceCaptain(selectedLineupPlayer.playerId)
                  }
                  disabled={disabled || selectedLineupPlayer.isCaptain}
                  className="h-4 w-4 rounded border-gray-300 text-blue-500 focus:ring-blue-300"
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

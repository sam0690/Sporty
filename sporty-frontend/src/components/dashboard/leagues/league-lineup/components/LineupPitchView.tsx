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
import { FormationRenderer } from "@/components/dashboard/shared/formation/FormationRenderer";
import {
  buildTeamLayout,
  type FormationSlot,
} from "@/components/dashboard/shared/formation/formationEngine";
import {
  getSportAccentClass,
  getSportIcon,
  getSportShortName,
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
  sport: "football" | "basketball" | "cricket";
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
            ? `cursor-grab border border-white/10 bg-surface/80 shadow-[0_14px_40px_rgba(0,0,0,0.25)] hover:scale-105 hover:shadow-[0_18px_48px_rgba(0,0,0,0.32)] ${isSelected ? "outline-2 outline-offset-2 outline-white/60" : ""}`
            : "border border-dashed border-white/20 bg-white/10 backdrop-blur-sm"
        } ${draggable.isDragging ? "rotate-1 shadow-lg" : ""} ${!isDropDisabled ? "" : "opacity-70"}`}
      >
        {player ? (
          <>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm text-white sm:h-10 sm:w-10">
              {getSportIcon(player.sport)}
            </div>
            <span
              className={`absolute -bottom-1 -right-1 rounded-full border px-1 py-0.5 text-[9px] font-semibold leading-none ${getSportAccentClass(player.sport)}`}
            >
              {getSportShortName(player.sport)}
            </span>
            <div className="pointer-events-none absolute top-[calc(100%+4px)] left-1/2 -translate-x-1/2 text-center">
              <p className="w-20 truncate text-xs font-medium text-white/90">
                {player.name}
              </p>
              <p className="text-[10px] text-white/70">
                {typeof player.points === "number"
                  ? `${player.points} pts`
                  : "0 pts"}
              </p>
            </div>

            {isCaptain ? (
              <span className="absolute -left-1 -top-1 rounded-full border border-yellow-300 bg-yellow-100 px-1 text-[10px] font-bold text-yellow-800">
                C
              </span>
            ) : null}
            {isViceCaptain ? (
              <span className="absolute -right-1 -top-1 rounded-full border border-blue-300 bg-primary/10 px-1 text-[10px] font-bold text-blue-800">
                VC
              </span>
            ) : null}

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRemove(slot.id);
              }}
              className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-surface/95 text-[10px] text-foreground/60 shadow hover:text-red-200"
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
      className="cursor-grab rounded-2xl border border-white/10 bg-white/5 p-3 shadow-[0_12px_36px_rgba(0,0,0,0.2)] transition hover:bg-white/8 hover:shadow-[0_16px_44px_rgba(0,0,0,0.28)]"
      title={`${player.name} | ${player.position} | ${player.realTeam} | Cost ${player.cost}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold text-foreground">
          {player.name}
        </p>
        <span className="text-base" aria-label={player.sport}>
          {getSportIcon(player.sport)}
        </span>
      </div>
      <p className="mt-1 text-xs text-foreground/60">{player.position}</p>
      <p className="mt-1 truncate text-xs text-foreground/60">
        {player.realTeam}
      </p>
      <p className="mt-1 text-xs font-medium text-accent-primary">
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

  const allSlotIds = useMemo(() => Object.keys(slotMetaById), [slotMetaById]);

  const emptySlots = useMemo(
    () =>
      allSlotIds.reduce<Record<string, string | null>>((acc, id) => {
        acc[id] = null;
        return acc;
      }, {}),
    [allSlotIds],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const [slotToPlayer, setSlotToPlayer] = useState<
    Record<string, string | null>
  >({});
  const [activeDragPlayerId, setActiveDragPlayerId] = useState<string | null>(
    null,
  );
  const [selectedPitchPlayerId, setSelectedPitchPlayerId] = useState<
    string | null
  >(null);

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

  useEffect(() => {
    const nextSlots: Record<string, string | null> = { ...emptySlots };

    layout.sections.forEach((section) => {
      section.slots.forEach((slot) => {
        nextSlots[slot.id] = slot.player ? slot.player.id : null;
      });
    });

    const frame = window.requestAnimationFrame(() => {
      setSlotToPlayer(nextSlots);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [layout, emptySlots]);

  const benchPlayers = useMemo(
    () =>
      pitchPlayers.filter((player) => {
        const lineupPlayer = lineupPlayerById[player.playerId];
        return !lineupPlayer?.isStarter;
      }),
    [pitchPlayers, lineupPlayerById],
  );

  const renderedLayout = useMemo(
    () => ({
      ...layout,
      sections: layout.sections.map((section) => ({
        ...section,
        slots: section.slots.map((slot) => ({
          ...slot,
          player: (() => {
            const assignedPlayerId = slotToPlayer[slot.id];
            return assignedPlayerId
              ? (playerById[assignedPlayerId] ?? null)
              : null;
          })(),
        })),
      })),
    }),
    [layout, slotToPlayer, playerById],
  );

  const activePlayers = useMemo(
    () =>
      renderedLayout.sections
        .flatMap((section) => section.slots)
        .map((slot) => slot.player)
        .filter((player): player is PitchPlayer => player !== null),
    [renderedLayout],
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

  const findCurrentSlotOfPlayer = (playerId: string): string | null => {
    const entry = Object.entries(slotToPlayer).find(
      ([, assignedPlayerId]) => assignedPlayerId === playerId,
    );
    return entry ? entry[0] : null;
  };

  const canPlaceInSlot = (player: PitchPlayer, slotId: string): boolean => {
    const slot = slotMetaById[slotId];
    return Boolean(slot && slot.sport === player.sport);
  };

  const canDropToSlot = (slotId: string): boolean => {
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

    setSlotToPlayer((prev) => ({ ...prev, [slotId]: null }));
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

    const targetSlot = overId.replace("slot-", "");
    if (!slotMetaById[targetSlot]) {
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
          <section className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-foreground">
                Bench Players
              </h3>
              <p className="text-xs text-foreground/55">Drag to pitch</p>
            </div>

            <div className="max-h-155 space-y-2 overflow-y-auto pr-1">
              {benchPlayers.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-foreground/55">
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
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-foreground/75">
                <span className="rounded-full border border-orange-400/20 bg-orange-500/10 px-3 py-1 font-medium text-orange-100">
                  🏀 Basketball: {activeSportCounts.basketball ?? 0} /{" "}
                  {MULTISPORT_STARTER_REQUIREMENTS.basketball}
                </span>
                <span className="rounded-full border border-accent-primary/30 bg-accent-primary/10 px-3 py-1 font-medium text-accent-primary">
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
            <div className="rounded-2xl border border-white/10 bg-surface/95 px-3 py-2 shadow-[0_18px_48px_rgba(0,0,0,0.35)]">
              <p className="text-sm font-medium text-foreground">
                {playerById[activeDragPlayerId].name}
              </p>
              <p className="text-xs text-foreground/60">
                {playerById[activeDragPlayerId].position}
              </p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <section className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">
            Captain Assignment
          </h3>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-foreground/60">
            Click a player on the pitch to assign C/VC
          </span>
        </div>

        {!selectedLineupPlayer ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4 text-center text-sm text-foreground/55">
            Select a starter on the pitch to assign captain or vice-captain.
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-semibold text-foreground">
              {selectedLineupPlayer.name}
            </p>
            <p className="mt-1 text-xs text-foreground/60">
              {selectedLineupPlayer.position} • {selectedLineupPlayer.realTeam}
            </p>

            <div className="mt-4 space-y-3">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={selectedLineupPlayer.isCaptain}
                  onChange={() => onSetCaptain(selectedLineupPlayer.playerId)}
                  disabled={disabled || selectedLineupPlayer.isViceCaptain}
                  className="h-4 w-4 rounded border-white/20 text-yellow-500 focus:ring-yellow-300"
                />
                Make Captain
              </label>

              <label className="flex items-center gap-2 text-sm text-foreground">
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

"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useParams } from "next/navigation";
import { useMe } from "@/hooks/auth/useMe";
import { toastifier } from "@/libs/toastifier";
import { NavigationTabs } from "@/components/dashboard/leagues/league-home/components/NavigationTabs";
import { EmptyState } from "@/components/dashboard/leagues/league-roster/components/EmptyState";
import { HybridPitch } from "@/components/dashboard/leagues/league-roster/components/HybridPitch";
import { PlayerList } from "@/components/dashboard/leagues/league-roster/components/PlayerList";
import {
  RosterHeader,
  type Sport,
} from "@/components/dashboard/leagues/league-roster/components/RosterHeader";
import { StatsSummary } from "@/components/dashboard/leagues/league-roster/components/StatsSummary";
import type { Player } from "@/components/dashboard/leagues/league-roster/components/PlayerCard";
import { PlayerCardSkeleton } from "@/components/ui/skeletons";

const SLOT_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
type SlotId = (typeof SLOT_IDS)[number];

const SPORT_ALLOWED_SLOTS: Record<Player["sport"], SlotId[]> = {
  football: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  basketball: [4, 5, 6, 7, 8],
  cricket: [1, 4, 7, 9],
};

const EMPTY_SLOTS: Record<number, number | null> = {
  1: null,
  2: null,
  3: null,
  4: null,
  5: null,
  6: null,
  7: null,
  8: null,
  9: null,
};

type Roster = {
  leagueId: string;
  leagueName: string;
  sport: Sport;
  rosterSize: number;
  maxRosterSize: number;
  totalPoints: number;
  avgPointsPerGame: number;
  bestPlayer: {
    name: string;
    points: number;
  };
  players: Player[];
};

const mockRosters: Record<string, Roster> = {
  "1": {
    leagueId: "1",
    leagueName: "Premier League Champions",
    sport: "football",
    rosterSize: 15,
    maxRosterSize: 20,
    totalPoints: 487,
    avgPointsPerGame: 97.4,
    bestPlayer: { name: "Lionel Messi", points: 87 },
    players: [
      {
        id: 1,
        name: "Lionel Messi",
        sport: "football",
        position: "Forward",
        totalPoints: 87,
        avgPoints: 9.2,
        projected: 12.5,
        form: "hot",
      },
      {
        id: 2,
        name: "Cristiano Ronaldo",
        sport: "football",
        position: "Forward",
        totalPoints: 76,
        avgPoints: 8.4,
        projected: 11.8,
        form: "hot",
      },
      {
        id: 3,
        name: "Kevin De Bruyne",
        sport: "football",
        position: "Midfielder",
        totalPoints: 65,
        avgPoints: 7.2,
        projected: 9.2,
        form: "normal",
      },
      {
        id: 4,
        name: "Rodri",
        sport: "football",
        position: "Midfielder",
        totalPoints: 54,
        avgPoints: 6.0,
        projected: 7.5,
        form: "normal",
      },
      {
        id: 5,
        name: "Virgil van Dijk",
        sport: "football",
        position: "Defender",
        totalPoints: 48,
        avgPoints: 5.3,
        projected: 6.8,
        form: "cold",
      },
      {
        id: 6,
        name: "Trent Alexander-Arnold",
        sport: "football",
        position: "Defender",
        totalPoints: 52,
        avgPoints: 5.8,
        projected: 7.2,
        form: "normal",
      },
      {
        id: 7,
        name: "Alisson",
        sport: "football",
        position: "Goalkeeper",
        totalPoints: 45,
        avgPoints: 5.0,
        projected: 5.5,
        form: "normal",
      },
    ],
  },
  "2": {
    leagueId: "2",
    leagueName: "NBA Fantasy 2025",
    sport: "basketball",
    rosterSize: 10,
    maxRosterSize: 15,
    totalPoints: 642,
    avgPointsPerGame: 128.4,
    bestPlayer: { name: "Nikola Jokic", points: 142 },
    players: [
      {
        id: 1,
        name: "Stephen Curry",
        sport: "basketball",
        position: "PG",
        totalPoints: 128,
        avgPoints: 14.2,
        projected: 18.5,
        form: "hot",
      },
      {
        id: 2,
        name: "LeBron James",
        sport: "basketball",
        position: "SF",
        totalPoints: 118,
        avgPoints: 13.1,
        projected: 16.8,
        form: "normal",
      },
      {
        id: 3,
        name: "Nikola Jokic",
        sport: "basketball",
        position: "C",
        totalPoints: 142,
        avgPoints: 15.8,
        projected: 19.5,
        form: "hot",
      },
      {
        id: 4,
        name: "Luka Doncic",
        sport: "basketball",
        position: "PG",
        totalPoints: 134,
        avgPoints: 14.9,
        projected: 17.8,
        form: "hot",
      },
      {
        id: 5,
        name: "Kevin Durant",
        sport: "basketball",
        position: "PF",
        totalPoints: 120,
        avgPoints: 13.3,
        projected: 17.2,
        form: "normal",
      },
    ],
  },
  "3": {
    leagueId: "3",
    leagueName: "Cricket World Cup",
    sport: "cricket",
    rosterSize: 12,
    maxRosterSize: 18,
    totalPoints: 387,
    avgPointsPerGame: 77.4,
    bestPlayer: { name: "Virat Kohli", points: 94 },
    players: [
      {
        id: 1,
        name: "Virat Kohli",
        sport: "cricket",
        position: "Batsman",
        totalPoints: 94,
        avgPoints: 10.4,
        projected: 14.2,
        form: "hot",
      },
      {
        id: 2,
        name: "Rohit Sharma",
        sport: "cricket",
        position: "Batsman",
        totalPoints: 82,
        avgPoints: 9.1,
        projected: 13.5,
        form: "normal",
      },
      {
        id: 3,
        name: "Jasprit Bumrah",
        sport: "cricket",
        position: "Bowler",
        totalPoints: 67,
        avgPoints: 7.4,
        projected: 10.2,
        form: "normal",
      },
      {
        id: 4,
        name: "Ravindra Jadeja",
        sport: "cricket",
        position: "AllRounder",
        totalPoints: 78,
        avgPoints: 8.7,
        projected: 12.2,
        form: "hot",
      },
      {
        id: 5,
        name: "MS Dhoni",
        sport: "cricket",
        position: "WK",
        totalPoints: 66,
        avgPoints: 7.3,
        projected: 8.5,
        form: "cold",
      },
    ],
  },
  "4": {
    leagueId: "4",
    leagueName: "Ultimate All-Stars",
    sport: "multisport",
    rosterSize: 15,
    maxRosterSize: 20,
    totalPoints: 897,
    avgPointsPerGame: 99.7,
    bestPlayer: { name: "Nikola Jokic", points: 142 },
    players: [
      {
        id: 1,
        name: "Lionel Messi",
        sport: "football",
        position: "Forward",
        totalPoints: 87,
        avgPoints: 9.2,
        projected: 12.5,
        form: "hot",
      },
      {
        id: 2,
        name: "Cristiano Ronaldo",
        sport: "football",
        position: "Forward",
        totalPoints: 76,
        avgPoints: 8.4,
        projected: 11.8,
        form: "hot",
      },
      {
        id: 3,
        name: "Kevin De Bruyne",
        sport: "football",
        position: "Midfielder",
        totalPoints: 65,
        avgPoints: 7.2,
        projected: 9.2,
        form: "normal",
      },
      {
        id: 4,
        name: "Rodri",
        sport: "football",
        position: "Midfielder",
        totalPoints: 54,
        avgPoints: 6.0,
        projected: 7.5,
        form: "normal",
      },
      {
        id: 5,
        name: "Virgil van Dijk",
        sport: "football",
        position: "Defender",
        totalPoints: 48,
        avgPoints: 5.3,
        projected: 6.8,
        form: "cold",
      },
      {
        id: 6,
        name: "Stephen Curry",
        sport: "basketball",
        position: "PG",
        totalPoints: 128,
        avgPoints: 14.2,
        projected: 18.5,
        form: "hot",
      },
      {
        id: 7,
        name: "LeBron James",
        sport: "basketball",
        position: "SF",
        totalPoints: 118,
        avgPoints: 13.1,
        projected: 16.8,
        form: "normal",
      },
      {
        id: 8,
        name: "Nikola Jokic",
        sport: "basketball",
        position: "C",
        totalPoints: 142,
        avgPoints: 15.8,
        projected: 19.5,
        form: "hot",
      },
      {
        id: 9,
        name: "Luka Doncic",
        sport: "basketball",
        position: "PG",
        totalPoints: 134,
        avgPoints: 14.9,
        projected: 17.8,
        form: "hot",
      },
      {
        id: 10,
        name: "Kevin Durant",
        sport: "basketball",
        position: "PF",
        totalPoints: 120,
        avgPoints: 13.3,
        projected: 17.2,
        form: "normal",
      },
      {
        id: 11,
        name: "Virat Kohli",
        sport: "cricket",
        position: "Batsman",
        totalPoints: 94,
        avgPoints: 10.4,
        projected: 14.2,
        form: "hot",
      },
      {
        id: 12,
        name: "Rohit Sharma",
        sport: "cricket",
        position: "Batsman",
        totalPoints: 82,
        avgPoints: 9.1,
        projected: 13.5,
        form: "normal",
      },
      {
        id: 13,
        name: "Jasprit Bumrah",
        sport: "cricket",
        position: "Bowler",
        totalPoints: 67,
        avgPoints: 7.4,
        projected: 10.2,
        form: "normal",
      },
      {
        id: 14,
        name: "Ravindra Jadeja",
        sport: "cricket",
        position: "AllRounder",
        totalPoints: 78,
        avgPoints: 8.7,
        projected: 12.2,
        form: "hot",
      },
      {
        id: 15,
        name: "MS Dhoni",
        sport: "cricket",
        position: "WK",
        totalPoints: 66,
        avgPoints: 7.3,
        projected: 8.5,
        form: "cold",
      },
    ],
  },
};

export function LeagueRoster() {
  const params = useParams<{ id: string }>();
  const { username } = useMe();

  const leagueId = params?.id ?? "1";
  const isCommissioner = leagueId === "1";
  const roster = mockRosters[leagueId] ?? mockRosters["1"];

  const [selectedPosition, setSelectedPosition] = useState("All");
  const [selectedSport, setSelectedSport] = useState("All");
  const [isLoading, setIsLoading] = useState(true);
  const [slotToPlayer, setSlotToPlayer] =
    useState<Record<number, number | null>>(EMPTY_SLOTS);
  const [savedSlotToPlayer, setSavedSlotToPlayer] =
    useState<Record<number, number | null>>(EMPTY_SLOTS);
  const [activeDragPlayerId, setActiveDragPlayerId] = useState<number | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  useEffect(() => {
    const nextSlots: Record<number, number | null> = { ...EMPTY_SLOTS };

    if (roster.sport === "multisport") {
      const footballPlayers = roster.players
        .filter((player) => player.sport === "football")
        .slice(0, 3);
      const basketballPlayers = roster.players
        .filter((player) => player.sport === "basketball")
        .slice(0, 3);
      const cricketPlayers = roster.players
        .filter((player) => player.sport === "cricket")
        .slice(0, 3);

      const preset: Array<{ slot: SlotId; player: Player | undefined }> = [
        { slot: 1, player: cricketPlayers[0] },
        { slot: 2, player: footballPlayers[0] },
        { slot: 3, player: footballPlayers[1] },
        { slot: 4, player: basketballPlayers[0] },
        { slot: 5, player: basketballPlayers[1] },
        { slot: 6, player: footballPlayers[2] },
        { slot: 7, player: basketballPlayers[2] },
        { slot: 8, player: cricketPlayers[1] },
        { slot: 9, player: cricketPlayers[2] },
      ];

      preset.forEach((item) => {
        nextSlots[item.slot] = item.player ? item.player.id : null;
      });
    } else {
      const allowed = SPORT_ALLOWED_SLOTS[roster.sport];
      const starters = roster.players.slice(
        0,
        Math.min(allowed.length, roster.players.length),
      );
      starters.forEach((player, index) => {
        const slotId = allowed[index];
        nextSlots[slotId] = player.id;
      });
    }

    setSlotToPlayer(nextSlots);
    setSavedSlotToPlayer(nextSlots);
  }, [roster]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setIsLoading(false);
    }, 450);

    return () => window.clearTimeout(timeout);
  }, []);

  const positions = useMemo(() => {
    const unique = Array.from(
      new Set(roster.players.map((player) => player.position)),
    );
    return ["All", ...unique];
  }, [roster.players]);

  const sports = useMemo(
    () => ["All", "football", "basketball", "cricket"],
    [],
  );

  const playerById = useMemo(() => {
    return roster.players.reduce<Record<number, Player>>((acc, player) => {
      acc[player.id] = player;
      return acc;
    }, {});
  }, [roster.players]);

  const assignedPlayerIds = useMemo(() => {
    return new Set(
      Object.values(slotToPlayer).filter((id): id is number => id !== null),
    );
  }, [slotToPlayer]);

  const listedPlayers = useMemo(() => {
    return roster.players.filter((player) => !assignedPlayerIds.has(player.id));
  }, [roster.players, assignedPlayerIds]);

  const slotAssignments = useMemo(() => {
    return SLOT_IDS.reduce<Record<number, Player | null>>((acc, slotId) => {
      const playerId = slotToPlayer[slotId];
      acc[slotId] = playerId ? playerById[playerId] : null;
      return acc;
    }, {});
  }, [slotToPlayer, playerById]);

  const activePlayers = useMemo(() => {
    return Object.values(slotAssignments).filter(
      (player): player is Player => player !== null,
    );
  }, [slotAssignments]);

  const activeCountsPerSport = useMemo(() => {
    return {
      football: activePlayers.filter((player) => player.sport === "football")
        .length,
      basketball: activePlayers.filter(
        (player) => player.sport === "basketball",
      ).length,
      cricket: activePlayers.filter((player) => player.sport === "cricket")
        .length,
    };
  }, [activePlayers]);

  const isMultiSport = roster.sport === "multisport";
  const isDirty =
    JSON.stringify(slotToPlayer) !== JSON.stringify(savedSlotToPlayer);

  const activeSportSummary = `⚽ ${activeCountsPerSport.football}/3 ${activeCountsPerSport.football === 3 ? "✅" : ""} | 🏀 ${activeCountsPerSport.basketball}/3 ${activeCountsPerSport.basketball === 3 ? "✅" : ""} | 🏏 ${activeCountsPerSport.cricket}/3 ${activeCountsPerSport.cricket === 3 ? "✅" : ""}`;

  const findCurrentSlotOfPlayer = (playerId: number): number | null => {
    const entry = Object.entries(slotToPlayer).find(
      ([, assignedPlayerId]) => assignedPlayerId === playerId,
    );
    return entry ? Number(entry[0]) : null;
  };

  const canPlaceInSlot = (player: Player, slotId: number): boolean => {
    return SPORT_ALLOWED_SLOTS[player.sport].includes(slotId as SlotId);
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

    return countInSport < 3;
  };

  const handleRemoveFromSlot = (slotId: number) => {
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
      return;
    }

    if (typeof overId !== "string" || !overId.startsWith("slot-")) {
      return;
    }

    const targetSlot = Number(overId.replace("slot-", ""));
    if (!SLOT_IDS.includes(targetSlot as SlotId)) {
      return;
    }

    if (!canPlaceInSlot(player, targetSlot)) {
      toastifier.warning(`! ${player.sport} cannot be placed in this position`);
      return;
    }

    const occupiedPlayerId = slotToPlayer[targetSlot];
    const currentSlot = findCurrentSlotOfPlayer(playerId);

    if (occupiedPlayerId && occupiedPlayerId !== playerId) {
      toastifier.error("✕ Slot already occupied");
      return;
    }

    const nextSlots = { ...slotToPlayer };
    if (currentSlot !== null) {
      nextSlots[currentSlot] = null;
    }

    const nextCounts = { football: 0, basketball: 0, cricket: 0 };
    Object.entries(nextSlots).forEach(([slotIdString, assignedPlayerId]) => {
      if (!assignedPlayerId) {
        return;
      }

      const slotId = Number(slotIdString);
      if (slotId === targetSlot) {
        return;
      }

      const assignedPlayer = playerById[assignedPlayerId];
      if (!assignedPlayer) {
        return;
      }

      nextCounts[assignedPlayer.sport] += 1;
    });

    if (isMultiSport && nextCounts[player.sport] >= 3) {
      toastifier.error(
        `✕ Cannot have more than 3 active players from ${player.sport}`,
      );
      return;
    }

    nextSlots[targetSlot] = playerId;
    setSlotToPlayer(nextSlots);
  };

  const handleSave = async () => {
    if (!isDirty) {
      toastifier.info("i No changes to save");
      return;
    }

    if (isMultiSport) {
      if (
        activeCountsPerSport.football !== 3 ||
        activeCountsPerSport.basketball !== 3 ||
        activeCountsPerSport.cricket !== 3
      ) {
        toastifier.error(
          "✕ Multi-Sport lineup requires exactly 3 players per sport",
        );
        return;
      }
    }

    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setSavedSlotToPlayer(slotToPlayer);
    setIsSaving(false);
    toastifier.success("✓ Lineup saved successfully");
  };

  if (isLoading) {
    return (
      <section className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="h-10 w-56 animate-pulse rounded-lg bg-gray-100" />
        <div className="mx-auto aspect-[3/4] w-full max-w-2xl rounded-2xl bg-gray-100 p-6">
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 9 }, (_, index) => (
              <div
                key={index}
                className="h-12 w-12 animate-pulse rounded-full bg-gray-200"
              />
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <PlayerCardSkeleton key={`roster-bench-skeleton-${index}`} />
          ))}
        </div>
      </section>
    );
  }

  if (roster.players.length === 0) {
    return <EmptyState leagueId={roster.leagueId} sport={roster.sport} />;
  }

  return (
    <section className="max-w-7xl mx-auto px-6 py-8 space-y-6 text-gray-900 [font-family:system-ui,-apple-system]">
      <p className="text-sm text-gray-500">
        Manager: {username || "Sporty User"}
      </p>

      <NavigationTabs
        activeTab="roster"
        leagueId={leagueId}
        isCommissioner={isCommissioner}
      />

      <RosterHeader
        leagueName={roster.leagueName}
        sport={roster.sport}
        rosterSize={roster.rosterSize}
        maxRosterSize={roster.maxRosterSize}
      />

      <StatsSummary
        totalPoints={roster.totalPoints}
        avgPointsPerGame={roster.avgPointsPerGame}
        bestPlayer={roster.bestPlayer}
        totalPlayers={roster.players.length}
      />

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
          <PlayerList
            players={listedPlayers}
            selectedSport={selectedSport}
            selectedPosition={selectedPosition}
            onSportChange={setSelectedSport}
            onPositionChange={setSelectedPosition}
            sports={sports}
            positions={positions}
          />

          <HybridPitch
            slotAssignments={slotAssignments}
            onRemoveFromSlot={handleRemoveFromSlot}
            activeCountsPerSport={activeCountsPerSport}
            isMultiSport={isMultiSport}
            canDropToSlot={canDropToSlot}
          />
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

      {isMultiSport ? (
        <div className="rounded-xl border border-gray-100 bg-white p-3 text-sm text-gray-700">
          Sport Limits: {activeSportSummary}
        </div>
      ) : null}

      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          className="rounded-full bg-primary-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isSaving ? "Saving..." : "Save Lineup"}
        </button>
      </div>
    </section>
  );
}

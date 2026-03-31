"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { toastifier } from "@/libs/toastifier";
import { BenchPlayers } from "@/components/dashboard/leagues/league-lineup/components/BenchPlayers";
import { EmptyState } from "@/components/dashboard/leagues/league-lineup/components/EmptyState";
import { LineupHeader } from "@/components/dashboard/leagues/league-lineup/components/LineupHeader";
import { NavigationTabs } from "@/components/dashboard/leagues/league-home/components/NavigationTabs";
import { PositionLimits } from "@/components/dashboard/leagues/league-lineup/components/PositionLimits";
import { SaveLineupButton } from "@/components/dashboard/leagues/league-lineup/components/SaveLineupButton";
import { StartingLineup } from "@/components/dashboard/leagues/league-lineup/components/StartingLineup";
import { type Player, type Sport } from "@/components/dashboard/leagues/league-lineup/components/PlayerSlot";
import { PlayerCardSkeleton } from "@/components/ui/skeletons";

type PositionLimit = {
  max: number;
  current: number;
};

type LeagueSport = Sport | "multisport";

const mockLeaguesById = {
  "1": {
    leagueId: "1",
    leagueName: "Premier League Champions",
    sport: "football" as const,
    currentWeek: 3,
    deadline: "2027-04-05T23:59:59",
  },
  "2": {
    leagueId: "2",
    leagueName: "NBA Fantasy 2025",
    sport: "basketball" as const,
    currentWeek: 3,
    deadline: "2027-04-05T23:59:59",
  },
  "3": {
    leagueId: "3",
    leagueName: "Cricket World Cup",
    sport: "cricket" as const,
    currentWeek: 3,
    deadline: "2027-04-05T23:59:59",
  },
  "4": {
    leagueId: "4",
    leagueName: "Ultimate All-Stars",
    sport: "multisport" as const,
    currentWeek: 3,
    deadline: "2027-04-05T23:59:59",
  },
};

function getRosterBySport(sport: LeagueSport): {
  positionLimits: Record<string, PositionLimit>;
  players: Array<Player & { isActive: boolean }>;
} {
  if (sport === "multisport") {
    return {
      positionLimits: {
        Forward: { max: 2, current: 2 },
        Midfielder: { max: 3, current: 1 },
        Defender: { max: 3, current: 2 },
        Goalkeeper: { max: 1, current: 1 },
        PointGuard: { max: 2, current: 1 },
        ShootingGuard: { max: 2, current: 0 },
        SmallForward: { max: 2, current: 1 },
        PowerForward: { max: 2, current: 0 },
        Center: { max: 1, current: 1 },
        Batsman: { max: 4, current: 1 },
        Bowler: { max: 4, current: 1 },
        AllRounder: { max: 2, current: 1 },
        WicketKeeper: { max: 1, current: 0 },
      },
      players: [
        { id: 1, name: "Lionel Messi", sport: "football", position: "Forward", projected: 12.5, isActive: true },
        { id: 2, name: "Cristiano Ronaldo", sport: "football", position: "Forward", projected: 11.8, isActive: true },
        { id: 3, name: "Kevin De Bruyne", sport: "football", position: "Midfielder", projected: 9.2, isActive: true },
        { id: 4, name: "Rodri", sport: "football", position: "Midfielder", projected: 7.5, isActive: false },
        { id: 5, name: "Virgil van Dijk", sport: "football", position: "Defender", projected: 6.8, isActive: false },
        { id: 6, name: "Stephen Curry", sport: "basketball", position: "PointGuard", projected: 18.5, isActive: true },
        { id: 7, name: "LeBron James", sport: "basketball", position: "SmallForward", projected: 16.8, isActive: true },
        { id: 8, name: "Nikola Jokic", sport: "basketball", position: "Center", projected: 19.5, isActive: true },
        { id: 9, name: "Luka Doncic", sport: "basketball", position: "PointGuard", projected: 17.8, isActive: false },
        { id: 10, name: "Kevin Durant", sport: "basketball", position: "PowerForward", projected: 17.2, isActive: false },
        { id: 11, name: "Virat Kohli", sport: "cricket", position: "Batsman", projected: 14.2, isActive: true },
        { id: 12, name: "Jasprit Bumrah", sport: "cricket", position: "Bowler", projected: 10.2, isActive: true },
        { id: 13, name: "Ravindra Jadeja", sport: "cricket", position: "AllRounder", projected: 12.2, isActive: true },
        { id: 14, name: "Rohit Sharma", sport: "cricket", position: "Batsman", projected: 13.5, isActive: false },
        { id: 15, name: "MS Dhoni", sport: "cricket", position: "WicketKeeper", projected: 8.5, isActive: false },
      ],
    };
  }

  if (sport === "basketball") {
    return {
      positionLimits: {
        PointGuard: { max: 2, current: 2 },
        ShootingGuard: { max: 2, current: 2 },
        SmallForward: { max: 2, current: 1 },
        PowerForward: { max: 2, current: 1 },
        Center: { max: 1, current: 1 },
      },
      players: [
        { id: 1, name: "Stephen Curry", sport, position: "PointGuard", projected: 18.5, isActive: true },
        { id: 2, name: "Luka Doncic", sport, position: "PointGuard", projected: 17.8, isActive: true },
        { id: 3, name: "Anthony Edwards", sport, position: "ShootingGuard", projected: 15.2, isActive: true },
        { id: 4, name: "Devin Booker", sport, position: "ShootingGuard", projected: 14.5, isActive: true },
        { id: 5, name: "LeBron James", sport, position: "SmallForward", projected: 16.8, isActive: true },
        { id: 6, name: "Kevin Durant", sport, position: "PowerForward", projected: 17.2, isActive: false },
        { id: 7, name: "Nikola Jokic", sport, position: "Center", projected: 19.5, isActive: true },
      ],
    };
  }

  if (sport === "cricket") {
    return {
      positionLimits: {
        Batsman: { max: 4, current: 4 },
        Bowler: { max: 4, current: 3 },
        AllRounder: { max: 2, current: 1 },
        WicketKeeper: { max: 1, current: 1 },
      },
      players: [
        { id: 1, name: "Virat Kohli", sport, position: "Batsman", projected: 14.2, isActive: true },
        { id: 2, name: "Rohit Sharma", sport, position: "Batsman", projected: 13.5, isActive: true },
        { id: 3, name: "Shubman Gill", sport, position: "Batsman", projected: 11.8, isActive: true },
        { id: 4, name: "KL Rahul", sport, position: "Batsman", projected: 10.5, isActive: true },
        { id: 5, name: "Jasprit Bumrah", sport, position: "Bowler", projected: 10.2, isActive: true },
        { id: 6, name: "Mohammed Shami", sport, position: "Bowler", projected: 9.8, isActive: true },
        { id: 7, name: "Ravindra Jadeja", sport, position: "AllRounder", projected: 12.2, isActive: true },
        { id: 8, name: "MS Dhoni", sport, position: "WicketKeeper", projected: 8.5, isActive: true },
      ],
    };
  }

  return {
    positionLimits: {
      Forward: { max: 2, current: 2 },
      Midfielder: { max: 3, current: 2 },
      Defender: { max: 3, current: 2 },
      Goalkeeper: { max: 1, current: 1 },
    },
    players: [
      { id: 1, name: "Lionel Messi", sport, position: "Forward", projected: 12.5, isActive: true },
      { id: 2, name: "Cristiano Ronaldo", sport, position: "Forward", projected: 11.8, isActive: true },
      { id: 3, name: "Kevin De Bruyne", sport, position: "Midfielder", projected: 9.2, isActive: true },
      { id: 4, name: "Rodri", sport, position: "Midfielder", projected: 7.5, isActive: false },
      { id: 5, name: "Virgil van Dijk", sport, position: "Defender", projected: 6.8, isActive: true },
      { id: 6, name: "Trent Alexander-Arnold", sport, position: "Defender", projected: 7.2, isActive: true },
      { id: 7, name: "Alisson", sport, position: "Goalkeeper", projected: 5.5, isActive: true },
    ],
  };
}

function activeIdsFromRoster(players: Array<Player & { isActive: boolean }>): number[] {
  return players.filter((player) => player.isActive).map((player) => player.id);
}

export function LeagueLineup() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();

  const leagueId = params?.id ?? "1";
  const isCommissioner = leagueId === "1";
  const selectedLeague = useMemo(() => {
    return mockLeaguesById[leagueId as keyof typeof mockLeaguesById] ?? mockLeaguesById["1"];
  }, [leagueId]);
  const rosterBySport = useMemo(() => getRosterBySport(selectedLeague.sport), [selectedLeague.sport]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const deadline = selectedLeague.deadline;
  const [activePlayerIds, setActivePlayerIds] = useState<number[]>(
    activeIdsFromRoster(rosterBySport.players),
  );
  const [originalLineup, setOriginalLineup] = useState<number[]>(
    activeIdsFromRoster(rosterBySport.players),
  );
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const nextActive = activeIdsFromRoster(rosterBySport.players);
    setActivePlayerIds(nextActive);
    setOriginalLineup(nextActive);
  }, [rosterBySport]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setIsLoading(false);
    }, 500);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTick((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      const dirty = JSON.stringify([...activePlayerIds].sort((a, b) => a - b)) !==
        JSON.stringify([...originalLineup].sort((a, b) => a - b));

      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [activePlayerIds, originalLineup]);

  const players = useMemo(() => rosterBySport.players, [rosterBySport]);
  const isMultiSport = selectedLeague.sport === "multisport";

  const deadlinePassed = useMemo(() => {
    return Date.now() > new Date(deadline).getTime();
  }, [deadline, tick]);

  const currentCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    players.forEach((player) => {
      if (!activePlayerIds.includes(player.id)) {
        return;
      }

      counts[player.position] = (counts[player.position] ?? 0) + 1;
    });

    return counts;
  }, [players, activePlayerIds]);

  const isLineupValid = useMemo(() => {
    return Object.entries(rosterBySport.positionLimits).every(([position, limit]) => {
      const current = currentCounts[position] ?? 0;
      return current <= limit.max;
    });
  }, [currentCounts, rosterBySport]);

  const isDirty = useMemo(() => {
    const sortedCurrent = [...activePlayerIds].sort((a, b) => a - b);
    const sortedOriginal = [...originalLineup].sort((a, b) => a - b);
    return JSON.stringify(sortedCurrent) !== JSON.stringify(sortedOriginal);
  }, [activePlayerIds, originalLineup]);

  const activePlayers = players.filter((player) => activePlayerIds.includes(player.id));
  const benchPlayers = players.filter((player) => !activePlayerIds.includes(player.id));
  const activeBySport = useMemo(() => {
    return {
      football: activePlayers.filter((player) => player.sport === "football").length,
      basketball: activePlayers.filter((player) => player.sport === "basketball").length,
      cricket: activePlayers.filter((player) => player.sport === "cricket").length,
    };
  }, [activePlayers]);
  const isMultiSportReady =
    activeBySport.football === 3 &&
    activeBySport.basketball === 3 &&
    activeBySport.cricket === 3 &&
    activePlayers.length === 9;

  const togglePlayer = (playerId: number) => {
    if (deadlinePassed) {
      toastifier.warning("Lineup is locked for this week.");
      return;
    }

    const player = players.find((item) => item.id === playerId);
    if (!player) {
      return;
    }

    setActivePlayerIds((prev) => {
      const currentlyActive = prev.includes(playerId);

      if (currentlyActive) {
        return prev.filter((id) => id !== playerId);
      }

      if (isMultiSport) {
        const activeInSport = players.filter(
          (item) => item.sport === player.sport && prev.includes(item.id),
        ).length;

        if (activeInSport >= 3) {
          const sportLabel = player.sport.charAt(0).toUpperCase() + player.sport.slice(1);
          toastifier.error(`✕ Cannot have more than 3 active players from ${sportLabel}`);
          return prev;
        }
      }

      const currentForPosition = players.filter(
        (item) => item.position === player.position && prev.includes(item.id),
      ).length;
      const limit = rosterBySport.positionLimits[player.position]?.max ?? Number.MAX_SAFE_INTEGER;

      if (!isMultiSport && currentForPosition >= limit) {
        toastifier.error(`✕ ${player.position} limit reached`);
        return prev;
      }

      return [...prev, playerId];
    });
  };

  const handleSave = async () => {
    if (deadlinePassed) {
      toastifier.error("✕ Lineup is locked");
      return;
    }

    if (!isLineupValid) {
      toastifier.error("✕ Lineup is invalid. Check position limits.");
      return;
    }

    if (isMultiSport && !isMultiSportReady) {
      toastifier.error("✕ Multi-Sport lineup requires exactly 3 active players from each sport");
      return;
    }

    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    setOriginalLineup(activePlayerIds);
    setIsSaving(false);
    toastifier.success("✓ Lineup saved successfully");
  };

  if (isLoading) {
    return (
      <section className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="h-10 w-56 animate-pulse rounded-lg bg-gray-100" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            {Array.from({ length: 5 }, (_, index) => (
              <PlayerCardSkeleton key={`lineup-skeleton-${index}`} />
            ))}
          </div>
          <div className="space-y-3 lg:col-span-1">
            {Array.from({ length: 3 }, (_, index) => (
              <PlayerCardSkeleton key={`bench-skeleton-${index}`} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (players.length === 0) {
    return <EmptyState leagueId={leagueId} />;
  }

  return (
    <section className="max-w-7xl mx-auto px-6 py-8 space-y-6 text-gray-900 [font-family:system-ui,-apple-system]">
      <p className="text-sm text-gray-500">Manager: {user?.name ?? "Sporty User"}</p>

      <NavigationTabs activeTab="lineup" leagueId={leagueId} isCommissioner={isCommissioner} />

      <LineupHeader
        leagueName={selectedLeague.leagueName}
        sport={selectedLeague.sport}
        currentWeek={selectedLeague.currentWeek}
        deadline={deadline}
      />

      {deadlinePassed ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          Lineup Locked. Deadline has passed for this week.
        </div>
      ) : null}

      <PositionLimits
        limits={rosterBySport.positionLimits}
        currentCounts={currentCounts}
        isMultiSport={isMultiSport}
      />

      {isMultiSport ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 text-sm">
          <p className="font-medium text-gray-900">
            Active Players: {activePlayers.length}/9 {isMultiSportReady ? "✅ Ready" : "⚠️ Need more"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                activeBySport.football === 3
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              ⚽ {activeBySport.football}/3
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                activeBySport.basketball === 3
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              🏀 {activeBySport.basketball}/3
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                activeBySport.cricket === 3
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              🏏 {activeBySport.cricket}/3
            </span>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <StartingLineup
            activePlayers={activePlayers}
            allPlayers={players}
            onTogglePlayer={togglePlayer}
            activePlayerIds={activePlayerIds}
            positionLimits={rosterBySport.positionLimits}
            totalSlots={isMultiSport ? 9 : undefined}
            disabled={deadlinePassed}
          />
        </div>

        <div className="lg:col-span-1">
          <BenchPlayers
            benchPlayers={benchPlayers}
            onTogglePlayer={togglePlayer}
            disabled={deadlinePassed}
          />
        </div>
      </div>

      {!isLineupValid ? (
        <p className="text-sm text-red-600">Position limits exceeded. Adjust your lineup before saving.</p>
      ) : null}

      {isMultiSport && !isMultiSportReady ? (
        <p className="text-sm text-amber-600">Multi-Sport lineup needs exactly 3 active players from each sport before saving.</p>
      ) : null}

      <SaveLineupButton
        onSave={handleSave}
        isLoading={isSaving}
        isDirty={isDirty}
        disabled={!isLineupValid || deadlinePassed || (isMultiSport && !isMultiSportReady)}
      />
    </section>
  );
}

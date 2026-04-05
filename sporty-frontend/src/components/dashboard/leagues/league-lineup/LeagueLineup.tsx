"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMe } from "@/hooks/auth/useMe";
import { toastifier } from "@/libs/toastifier";
import { BenchPlayers } from "@/components/dashboard/leagues/league-lineup/components/BenchPlayers";
import { EmptyState } from "@/components/dashboard/leagues/league-lineup/components/EmptyState";
import { LineupHeader } from "@/components/dashboard/leagues/league-lineup/components/LineupHeader";
import { NavigationTabs } from "@/components/dashboard/leagues/league-home/components/NavigationTabs";
import { PositionLimits } from "@/components/dashboard/leagues/league-lineup/components/PositionLimits";
import { SaveLineupButton } from "@/components/dashboard/leagues/league-lineup/components/SaveLineupButton";
import { StartingLineup } from "@/components/dashboard/leagues/league-lineup/components/StartingLineup";
import { useActiveWindow, useLeague, useLineup, useUpdateLineup } from "@/hooks/leagues/useLeagues";
import {
  type Player,
  type Sport,
} from "@/components/dashboard/leagues/league-lineup/components/PlayerSlot";
import { PlayerCardSkeleton } from "@/components/ui/skeletons";

type PositionLimit = {
  max: number;
  current: number;
};

type LeagueSport = Sport | "multisport";

export function LeagueLineup() {
  const params = useParams<{ id: string }>();
  const leagueId = params?.id;
  const { data: me } = useMe();

  const { data: league, isLoading: leagueLoading } = useLeague(leagueId!);
  const { data: lineupData, isLoading: lineupLoading } = useLineup(leagueId!);
  const { data: activeWindow, isLoading: isWindowLoading } = useActiveWindow(leagueId!);
  const updateLineupMutation = useUpdateLineup(leagueId!);

  const isCommissioner = league?.owner?.id === me?.id;

  // Map league info
  const selectedLeague = useMemo(() => {
    if (!league) return null;
    return {
      leagueId: league.id,
      leagueName: league.name,
      sport: (league.sports?.[0]?.sport.name as LeagueSport) || "multisport",
      currentWeek: activeWindow?.number || 1,
      totalWeeks: activeWindow?.total_number || 16,
      deadline: activeWindow?.lineup_deadline_at || league.created_at,
    };
  }, [league, activeWindow]);

  // Map lineup entries to UI format
  const players: Array<Player & { isActive: boolean }> = useMemo(() => {
    if (!lineupData?.entries) return [];
    return lineupData.entries.map(e => ({
      id: e.player_id as any,
      name: e.player.display_name,
      sport: e.player.sport_name as Sport,
      position: e.player.position,
      projected: 0,
      isActive: true,
      isCaptain: e.is_captain,
      isViceCaptain: e.is_vice_captain,
    }));
  }, [lineupData]);

  // Compute limits from league lineup slots
  const positionLimits: Record<string, PositionLimit> = useMemo(() => {
    if (!league?.lineup_slots) return {};
    const limits: Record<string, PositionLimit> = {};
    league.lineup_slots.forEach(slot => {
      limits[slot.position] = { max: slot.max_count, current: 0 };
    });
    return limits;
  }, [league]);

  const [isLoadingUI, setIsLoadingUI] = useState(true);
  const deadline = selectedLeague?.deadline || new Date().toISOString();

  const [activePlayerIds, setActivePlayerIds] = useState<any[]>([]);
  const [originalLineup, setOriginalLineup] = useState<any[]>([]);
  const [captainId, setCaptainId] = useState<any>(null);
  const [viceCaptainId, setViceCaptainId] = useState<any>(null);

  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (players.length > 0) {
      const ids = players.map(p => p.id);
      setActivePlayerIds(ids);
      setOriginalLineup(ids);

      const cap = players.find(p => p.isCaptain);
      const vice = players.find(p => p.isViceCaptain);
      if (cap) setCaptainId(cap.id);
      if (vice) setViceCaptainId(vice.id);
    }
  }, [players]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setIsLoadingUI(false);
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
      const dirty =
        JSON.stringify([...activePlayerIds].sort((a, b) => a - b)) !==
        JSON.stringify([...originalLineup].sort((a, b) => a - b));

      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [activePlayerIds, originalLineup]);

  const isMultiSport = (selectedLeague?.sport as string) === "multisport";

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
    return Object.entries(positionLimits).every(
      ([position, limit]) => {
        const current = currentCounts[position] ?? 0;
        return current <= limit.max;
      },
    );
  }, [currentCounts, positionLimits]);

  const isDirty = useMemo(() => {
    const sortedCurrent = [...activePlayerIds].sort().join();
    const sortedOriginal = [...originalLineup].sort().join();
    return sortedCurrent !== sortedOriginal;
  }, [activePlayerIds, originalLineup]);

  const activePlayers = players.filter((player) =>
    activePlayerIds.includes(player.id),
  );
  const benchPlayers = players.filter(
    (player) => !activePlayerIds.includes(player.id),
  );

  const activeBySport = useMemo(() => {
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

  const isMultiSportReady =
    activeBySport.football === 3 &&
    activeBySport.basketball === 3 &&
    activeBySport.cricket === 3 &&
    activePlayers.length === 9;

  const togglePlayer = (playerId: any) => {
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
          const sportLabel =
            player.sport.charAt(0).toUpperCase() + player.sport.slice(1);
          toastifier.error(
            `✕ Cannot have more than 3 active players from ${sportLabel}`,
          );
          return prev;
        }
      }

      const currentForPosition = players.filter(
        (item) => item.position === player.position && prev.includes(item.id),
      ).length;
      const limit =
        positionLimits[player.position]?.max ??
        Number.MAX_SAFE_INTEGER;

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
      toastifier.error(
        "✕ Multi-Sport lineup requires exactly 3 active players from each sport",
      );
      return;
    }

    if (!captainId || !viceCaptainId) {
      toastifier.error("✕ Please select a captain and vice-captain");
      return;
    }

    try {
      await updateLineupMutation.mutateAsync({
        player_ids: activePlayerIds.map(id => id.toString()),
        captain_id: captainId.toString(),
        vice_captain_id: viceCaptainId.toString(),
      });
      setOriginalLineup(activePlayerIds);
    } catch (err) {
      // toastifier handled by hook
    }
  };

  if (leagueLoading || lineupLoading || isWindowLoading || isLoadingUI || !selectedLeague) {
    return (
      <section className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="h-12 rounded-lg bg-gray-100 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-[400px] rounded-2xl bg-gray-100 animate-pulse" />
          </div>
          <div className="lg:col-span-1">
            <div className="h-[600px] rounded-2xl bg-gray-100 animate-pulse" />
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
      <p className="text-sm text-gray-500">
        Manager: {me?.username || "Sporty User"}
      </p>

      <NavigationTabs
        activeTab="lineup"
        leagueId={leagueId!}
        isCommissioner={isCommissioner}
      />

      <LineupHeader
        leagueName={selectedLeague.leagueName}
        sport={selectedLeague.sport as Sport}
        currentWeek={selectedLeague.currentWeek}
        totalWeeks={selectedLeague.totalWeeks}
        deadline={selectedLeague.deadline}
      />

      {deadlinePassed ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          Lineup Locked. Deadline has passed for this week.
        </div>
      ) : null}

      <PositionLimits
        limits={positionLimits}
        currentCounts={currentCounts}
        isMultiSport={isMultiSport}
      />

      {isMultiSport ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 text-sm">
          <p className="font-medium text-gray-900">
            Active Players: {activePlayers.length}/9{" "}
            {isMultiSportReady ? "✅ Ready" : "⚠️ Need more"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${activeBySport.football === 3
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
                }`}
            >
              ⚽ {activeBySport.football}/3
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${activeBySport.basketball === 3
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
                }`}
            >
              🏀 {activeBySport.basketball}/3
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${activeBySport.cricket === 3
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
            positionLimits={positionLimits}
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
        <p className="text-sm text-red-600">
          Position limits exceeded. Adjust your lineup before saving.
        </p>
      ) : null}

      {isMultiSport && !isMultiSportReady ? (
        <p className="text-sm text-amber-600">
          Multi-Sport lineup needs exactly 3 active players from each sport
          before saving.
        </p>
      ) : null}

      <SaveLineupButton
        onSave={handleSave}
        isLoading={updateLineupMutation.isPending}
        isDirty={isDirty}
        disabled={
          !isLineupValid ||
          deadlinePassed ||
          (isMultiSport && !isMultiSportReady)
        }
      />
    </section>
  );
}

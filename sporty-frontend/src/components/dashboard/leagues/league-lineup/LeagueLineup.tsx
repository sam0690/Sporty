"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useMe } from "@/hooks/auth/useMe";
import { EmptyState } from "@/components/dashboard/leagues/league-lineup/components/EmptyState";
import { ErrorState } from "@/components/dashboard/leagues/league-lineup/components/ErrorState";
import { LineupHeader } from "@/components/dashboard/leagues/league-lineup/components/LineupHeader";
import { LineupContainer } from "@/components/dashboard/leagues/league-lineup/components/LineupContainer";
import { LineupSkeleton } from "@/components/dashboard/leagues/league-lineup/components/LineupSkeleton";
import { NavigationTabs } from "@/components/dashboard/leagues/league-home/components/NavigationTabs";
import { useActiveWindow, useLeague } from "@/hooks/leagues/useLeagues";
import { useLeagueLineupData } from "@/components/dashboard/leagues/league-lineup/hooks/useLeagueLineupData";

type HeaderSport = "football" | "basketball" | "cricket" | "multisport";
const FALLBACK_DEADLINE = "2099-01-01T00:00:00.000Z";

export function LeagueLineup() {
  const params = useParams<{ id: string }>();
  const leagueId = params?.id ?? "";
  const { data: me } = useMe();

  const {
    data: league,
    isLoading: leagueLoading,
    error: leagueError,
  } = useLeague(leagueId);
  const {
    data: activeWindow,
    isLoading: isWindowLoading,
    error: windowError,
  } = useActiveWindow(leagueId);
  const {
    players,
    starters,
    bench,
    startersGroupedBySport,
    benchGroupedBySport,
    isLoading: lineupLoading,
    error: lineupError,
    isEmpty,
    refetch: refetchLineup,
  } = useLeagueLineupData(leagueId);

  const isCommissioner = league?.owner?.id === me?.id;

  const selectedLeague = useMemo(() => {
    if (!league) return null;

    const sportName = league.sports?.[0]?.sport.name;
    const hasManySports = (league.sports?.length ?? 0) > 1;

    const sport = hasManySports
      ? "multisport"
      : sportName === "football" ||
          sportName === "basketball" ||
          sportName === "cricket"
        ? sportName
        : "multisport";

    return {
      leagueId: league.id,
      leagueName: league.name,
      sport,
      currentWeek: activeWindow?.number || 1,
      totalWeeks: activeWindow?.total_number || 16,
      deadline: activeWindow?.lineup_deadline_at || FALLBACK_DEADLINE,
    };
  }, [league, activeWindow]);

  if (leagueLoading || lineupLoading || isWindowLoading || !selectedLeague) {
    return <LineupSkeleton />;
  }

  if (leagueError || lineupError || windowError) {
    const message =
      leagueError?.message || lineupError?.message || windowError?.message;

    return (
      <section className="max-w-7xl mx-auto px-6 py-8 space-y-6 font-[system-ui,-apple-system] text-gray-900">
        <NavigationTabs
          activeTab="lineup"
          leagueId={leagueId}
          isCommissioner={isCommissioner}
        />
        <ErrorState message={message} onRetry={refetchLineup} />
      </section>
    );
  }

  if (isEmpty) {
    return <EmptyState leagueId={leagueId} />;
  }

  return (
    <section className="max-w-7xl mx-auto px-6 py-8 space-y-6 font-[system-ui,-apple-system] text-gray-900">
      <p className="text-sm text-gray-500">
        Manager: {me?.username || "Sporty User"}
      </p>

      <NavigationTabs
        activeTab="lineup"
        leagueId={leagueId}
        isCommissioner={isCommissioner}
      />

      <LineupHeader
        leagueName={selectedLeague.leagueName}
        sport={selectedLeague.sport as HeaderSport}
        currentWeek={selectedLeague.currentWeek}
        totalWeeks={selectedLeague.totalWeeks}
        deadline={selectedLeague.deadline}
      />

      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
          <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1">
            Total Players: {players.length}
          </span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-800">
            Starting XI: {starters.length}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
            Bench: {bench.length}
          </span>
          <span className="rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-yellow-800">
            Captain: {players.find((player) => player.isCaptain)?.name || "N/A"}
          </span>
          <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-800">
            Vice-Captain:{" "}
            {players.find((player) => player.isViceCaptain)?.name || "N/A"}
          </span>
        </div>
      </div>

      <LineupContainer
        startersGroupedBySport={startersGroupedBySport}
        benchGroupedBySport={benchGroupedBySport}
      />
    </section>
  );
}

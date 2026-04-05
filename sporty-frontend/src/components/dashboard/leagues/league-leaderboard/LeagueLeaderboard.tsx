"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMe } from "@/hooks/auth/useMe";
import { NavigationTabs } from "@/components/dashboard/leagues/league-home/components/NavigationTabs";
import { EmptyState } from "@/components/dashboard/leagues/league-leaderboard/components/EmptyState";
import { LeaderboardFilters } from "@/components/dashboard/leagues/league-leaderboard/components/LeaderboardFilters";
import {
  LeaderboardHeader,
  type Sport,
} from "@/components/dashboard/leagues/league-leaderboard/components/LeaderboardHeader";
import {
  StandingsTable,
  type Standing,
  type WeeklyStanding,
} from "@/components/dashboard/leagues/league-leaderboard/components/StandingsTable";
import {
  StatsHighlight,
  type StatsHighlights,
} from "@/components/dashboard/leagues/league-leaderboard/components/StatsHighlight";
import { UserRankCard } from "@/components/dashboard/leagues/league-leaderboard/components/UserRankCard";
import { WeekSelector, type SelectedWeek } from "@/components/dashboard/leagues/league-leaderboard/components/WeekSelector";
import { CardSkeleton, TableSkeleton } from "@/components/ui/skeletons";
import { useLeaderboard, useLeague, useMyTeam, useActiveWindow } from "@/hooks/leagues/useLeagues";
import type { TLeaderboardEntry, TLeaderboardResponse } from "@/types";

type LeaderboardData = {
  leagueId: string;
  leagueName: string;
  sport: Sport;
  currentWeek: number;
  totalWeeks: number;
  userTeamId: string;
  userTeam: {
    rank: number;
    teamName: string;
    totalPoints: number;
    wins: number;
    losses: number;
    pointsBehind: number;
  };
  statsHighlights: StatsHighlights;
  groups: string[];
  standings: Standing[];
};


export function LeagueLeaderboard() {
  const params = useParams<{ id: string }>();
  const leagueId = params?.id ?? "";

  const { data: league, isLoading: isLeagueLoading } = useLeague(leagueId);
  const { data: myTeam, isLoading: isTeamLoading } = useMyTeam(leagueId);
  const { data: activeWindow, isLoading: isWindowLoading } = useActiveWindow(leagueId);
  const { username } = useMe();

  const [selectedWeek, setSelectedWeek] = useState<SelectedWeek>("overall");
  const [selectedGroup, setSelectedGroup] = useState("Overall");

  const { data: leaderboard, isLoading: isLeaderboardLoading } = useLeaderboard(
    leagueId,
    selectedWeek === "overall" ? undefined : selectedWeek.toString()
  );

  const isCommissioner = league?.owner?.username === username;

  const standings = useMemo<Standing[]>(() => {
    if (!leaderboard) return [];

    return leaderboard.entries.map(entry => ({
      rank: entry.rank ?? 0,
      teamId: entry.team_id,
      teamName: entry.team_name,
      manager: entry.owner_name,
      totalPoints: Number(entry.points),
      weeklyAvg: 0, // Not available yet
      wins: 0,
      losses: 0,
      streak: "-",
      group: "Overall",
      weeklyScores: {}, // Not fully supported yet
    }));
  }, [leaderboard]);

  const userTeam = useMemo(() => {
    if (!myTeam || !standings.length) return null;
    const teamInStandings = standings.find(s => s.teamId === myTeam.id);
    if (!teamInStandings) return null;

    const topPoints = standings[0].totalPoints;

    return {
      rank: teamInStandings.rank,
      teamName: teamInStandings.teamName,
      totalPoints: teamInStandings.totalPoints,
      wins: 0,
      losses: 0,
      pointsBehind: topPoints - teamInStandings.totalPoints
    };
  }, [myTeam, standings]);

  const isLoading = isLeagueLoading || isTeamLoading || isLeaderboardLoading || isWindowLoading;

  if (isLoading) {
    return (
      <section className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-gray-100" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <TableSkeleton />
      </section>
    );
  }

  if (!league) {
    return <EmptyState message="League not found." />;
  }

  return (
    <section className="max-w-6xl mx-auto px-6 py-8 space-y-6 text-gray-900 [font-family:system-ui,-apple-system]">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">
          Manager: {username || "Sporty User"}
        </p>
      </div>

      <NavigationTabs
        activeTab="leaderboard"
        leagueId={leagueId}
        isCommissioner={isCommissioner}
      />

      <LeaderboardHeader
        leagueName={league.name}
        sport={league.sports[0]?.sport.name as Sport || "football"}
        currentWeek={activeWindow?.number || 1}
        totalWeeks={activeWindow?.total_number || 16}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <WeekSelector
          currentWeek={activeWindow?.number || 1}
          totalWeeks={activeWindow?.total_number || 16}
          selectedWeek={selectedWeek}
          onWeekChange={setSelectedWeek}
        />

        <LeaderboardFilters
          selectedGroup={selectedGroup}
          groups={["Overall"]}
          onGroupChange={setSelectedGroup}
        />
      </div>

      {/* StatsHighlight hidden for now as we don't have this data yet */}

      {userTeam && (
        <UserRankCard
          rank={userTeam.rank}
          teamName={userTeam.teamName}
          totalPoints={userTeam.totalPoints}
          wins={userTeam.wins}
          losses={userTeam.losses}
          pointsBehind={userTeam.pointsBehind}
        />
      )}

      {standings.length === 0 ? (
        <EmptyState message="No standings available yet." />
      ) : (
        <StandingsTable
          standings={standings}
          userTeamId={myTeam?.id || ""}
          selectedWeek={selectedWeek}
          weeklyStandings={[]} // Needs additional window data
        />
      )}
    </section>
  );
}

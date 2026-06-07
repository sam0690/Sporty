"use client";

import { useMemo, useState } from "react";
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
} from "@/components/dashboard/leagues/league-leaderboard/components/StandingsTable";
import { UserRankCard } from "@/components/dashboard/leagues/league-leaderboard/components/UserRankCard";
import {
  WeekSelector,
  type SelectedWeek,
} from "@/components/dashboard/leagues/league-leaderboard/components/WeekSelector";
import { CardSkeleton, TableSkeleton } from "@/components/ui/skeletons";
import {
  useLeaderboard,
  useLeague,
  useMyTeam,
  useActiveWindow,
} from "@/hooks/leagues/useLeagues";

export function LeagueLeaderboard() {
  const params = useParams<{ id: string }>();
  const leagueId = params?.id ?? "";

  const { data: league, isLoading: isLeagueLoading } = useLeague(leagueId);
  const { data: myTeam, isLoading: isTeamLoading } = useMyTeam(leagueId);
  const { data: activeWindow, isLoading: isWindowLoading } =
    useActiveWindow(leagueId);
  const { username } = useMe();

  const [selectedWeek, setSelectedWeek] = useState<SelectedWeek>("overall");
  const [selectedGroup, setSelectedGroup] = useState("Overall");
  const [historical, setHistorical] = useState(true);

  const { data: leaderboard, isLoading: isLeaderboardLoading } = useLeaderboard(
    leagueId,
    selectedWeek === "overall" ? undefined : selectedWeek.toString(),
    historical,
  );

  const isCommissioner = league?.owner?.username === username;

  const standings = useMemo<Standing[]>(() => {
    if (!leaderboard) return [];
    return leaderboard.entries.map((entry) => ({
      rank: entry.rank ?? 0,
      teamId: entry.team_id,
      teamName: entry.team_name,
      manager: entry.owner_name,
      totalPoints: Number(entry.points),
      weeklyAvg: 0,
      wins: 0,
      losses: 0,
      streak: "-",
      group: "Overall",
      weeklyScores: {},
    }));
  }, [leaderboard]);

  const userTeam = useMemo(() => {
    if (!myTeam || !standings.length) return null;
    const teamInStandings = standings.find((s) => s.teamId === myTeam.id);
    if (!teamInStandings) return null;
    const topPoints = standings[0].totalPoints;
    return {
      rank: teamInStandings.rank,
      teamName: teamInStandings.teamName,
      totalPoints: teamInStandings.totalPoints,
      wins: 0,
      losses: 0,
      pointsBehind: topPoints - teamInStandings.totalPoints,
    };
  }, [myTeam, standings]);

  const isLoading =
    isLeagueLoading || isTeamLoading || isLeaderboardLoading || isWindowLoading;

  if (isLoading) {
    return (
      <section className="mx-auto max-w-6xl space-y-4 px-6 py-8">
        <div className="h-10 w-64 animate-pulse rounded-[3px] bg-[#1d1d26]" />
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
    <section className="mx-auto max-w-6xl space-y-5 px-6 py-8 text-[#f0f0f0]">
      <p className="section-label">Manager: {username || "Sporty User"}</p>

      <NavigationTabs
        activeTab="leaderboard"
        leagueId={leagueId}
        isCommissioner={isCommissioner}
      />

      <LeaderboardHeader
        leagueName={league.name}
        sport={(league.sports[0]?.sport.name as Sport) || "football"}
        seasonName={league.season?.name}
        currentWeek={activeWindow?.number || 1}
        totalWeeks={activeWindow?.total_number || 16}
      />

      {/* Filters bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] p-3">
        <div className="flex flex-wrap items-center gap-2">
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

        <div className="inline-flex rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-0.5">
          {(["Historical", "Live"] as const).map((mode) => {
            const isActive = mode === "Historical" ? historical : !historical;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setHistorical(mode === "Historical")}
                className={`rounded-[3px] px-3 py-1.5 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] transition-colors ${
                  isActive
                    ? "bg-[#e8fb25] text-[#0a0a0f]"
                    : "text-[#555560] hover:text-[#f0f0f0]"
                }`}
              >
                {mode}
              </button>
            );
          })}
        </div>
      </div>

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
          weeklyStandings={[]}
        />
      )}
    </section>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { CurrentMatchup } from "@/components/dashboard/leagues/league-home/components/CurrentMatchup";
import { EmptyState } from "@/components/dashboard/leagues/league-home/components/EmptyState";
import { LeagueHeader } from "@/components/dashboard/leagues/league-home/components/LeagueHeader";
import { NavigationTabs } from "@/components/dashboard/leagues/league-home/components/NavigationTabs";
import { StandingsTable } from "@/components/dashboard/leagues/league-home/components/StandingsTable";
import { WeekSelector } from "@/components/dashboard/leagues/league-home/components/WeekSelector";
import { YourScoreCard } from "@/components/dashboard/leagues/league-home/components/YourScoreCard";

const mockLeague = {
  id: "1",
  name: "Premier League Champions",
  sport: "football" as const,
  currentWeek: 3,
  totalWeeks: 16,
  userTeam: {
    id: "team1",
    name: "Goal Rush",
    score: 87,
    weeklyRank: 2,
    pointsBehind: 12,
  },
  currentMatchup: {
    opponentTeam: "FC Legends",
    opponentScore: 72,
  },
  standings: [
    { rank: 1, teamId: "team2", teamName: "Dunk FC", points: 245, wins: 2, losses: 0 },
    { rank: 2, teamId: "team1", teamName: "Goal Rush", points: 212, wins: 1, losses: 1 },
    { rank: 3, teamId: "team3", teamName: "FC United", points: 198, wins: 0, losses: 2 },
  ],
};

export function LeagueHome() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();

  const leagueId = params?.id ?? mockLeague.id;
  const [currentWeek, setCurrentWeek] = useState(mockLeague.currentWeek);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setIsLoading(false);
    }, 450);

    return () => {
      window.clearTimeout(timeout);
    };
  }, []);

  const league = useMemo(() => {
    if (leagueId !== mockLeague.id) {
      return { ...mockLeague, id: leagueId };
    }

    return mockLeague;
  }, [leagueId]);

  const hasData = league.standings.length > 0;

  if (isLoading) {
    return (
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="h-12 rounded-lg bg-gray-200 animate-pulse" />
        <div className="h-10 w-40 rounded-lg bg-gray-200 animate-pulse" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="h-72 rounded-lg bg-gray-200 animate-pulse lg:col-span-2" />
          <div className="space-y-6 lg:col-span-1">
            <div className="h-36 rounded-lg bg-gray-200 animate-pulse" />
            <div className="h-36 rounded-lg bg-gray-200 animate-pulse" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 text-text-primary">
      <div className="text-sm text-text-secondary">Manager: {user?.name ?? "Sporty User"}</div>

      <LeagueHeader
        leagueName={league.name}
        sport={league.sport}
        currentWeek={currentWeek}
        totalWeeks={league.totalWeeks}
      />

      <WeekSelector
        currentWeek={currentWeek}
        totalWeeks={league.totalWeeks}
        onWeekChange={(week) => {
          if (week < 1 || week > league.totalWeeks) {
            return;
          }

          setCurrentWeek(week);
        }}
      />

      {hasData ? (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <StandingsTable standings={league.standings} userTeamId={league.userTeam.id} />
            </div>

            <div className="space-y-6 lg:col-span-1">
              <CurrentMatchup
                yourTeamName={league.userTeam.name}
                yourScore={league.userTeam.score}
                opponentTeamName={league.currentMatchup.opponentTeam}
                opponentScore={league.currentMatchup.opponentScore}
              />
              <YourScoreCard
                yourScore={league.userTeam.score}
                weeklyRank={league.userTeam.weeklyRank}
                pointsBehind={league.userTeam.pointsBehind}
              />
            </div>
          </div>

          <NavigationTabs activeTab="lineup" leagueId={league.id} />
        </>
      ) : (
        <EmptyState message="No data available for this league" />
      )}
    </section>
  );
}

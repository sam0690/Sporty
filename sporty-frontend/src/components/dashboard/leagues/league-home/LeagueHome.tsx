"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { toastifier } from "@/libs/toastifier";
import { CurrentMatchup } from "@/components/dashboard/leagues/league-home/components/CurrentMatchup";
import { EmptyState } from "@/components/dashboard/leagues/league-home/components/EmptyState";
import { LeagueHeader } from "@/components/dashboard/leagues/league-home/components/LeagueHeader";
import { NavigationTabs } from "@/components/dashboard/leagues/league-home/components/NavigationTabs";
import { StandingsTable } from "@/components/dashboard/leagues/league-home/components/StandingsTable";
import { WeekSelector } from "@/components/dashboard/leagues/league-home/components/WeekSelector";
import { YourScoreCard } from "@/components/dashboard/leagues/league-home/components/YourScoreCard";
import { CardSkeleton, TableSkeleton } from "@/components/ui/skeletons";

const mockLeague = {
  id: "1",
  name: "Premier League Champions",
  sport: "football" as const,
  currentWeek: 3,
  totalWeeks: 16,
  isCommissioner: true,
  isPublic: false,
  inviteCode: "ABCD-1234-EFGH",
  members: [
    { id: 1, name: "John Doe", teamName: "Goal Rush", joinDate: "2025-01-01", totalPoints: 212 },
    { id: 2, name: "Mike T.", teamName: "Dunk FC", joinDate: "2025-01-02", totalPoints: 245 },
    { id: 3, name: "Sarah K.", teamName: "FC United", joinDate: "2025-01-03", totalPoints: 198 },
  ],
  scoringRules: {
    goal: 5,
    assist: 3,
    cleanSheet: 4,
    save: 1,
  },
  teamSize: 11,
  draftType: "snake",
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
  const router = useRouter();
  const { user } = useAuth();

  const leagueId = params?.id ?? mockLeague.id;
  const [currentWeek, setCurrentWeek] = useState(mockLeague.currentWeek);
  const [isLoading, setIsLoading] = useState(true);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

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
  const isCommissioner = league.isCommissioner;

  const handleLeaveLeague = async () => {
    if (isCommissioner) {
      toastifier.error("✕ Transfer commissioner role before leaving this league");
      return;
    }

    setIsLeaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsLeaving(false);
    setShowLeaveModal(false);
    toastifier.success("You left the league.");
    router.push("/leagues");
  };

  if (isLoading) {
    return (
      <section className="max-w-6xl mx-auto px-6 py-8 space-y-6 [font-family:system-ui,-apple-system]">
        <div className="h-12 rounded-lg bg-gray-200 animate-pulse" />
        <div className="h-10 w-40 rounded-lg bg-gray-200 animate-pulse" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <TableSkeleton />
          </div>
          <div className="space-y-6 lg:col-span-1">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-6xl mx-auto px-6 py-8 space-y-6 text-gray-900 [font-family:system-ui,-apple-system]">
      <div className="text-sm text-gray-500">Manager: {user?.name ?? "Sporty User"}</div>

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

      <NavigationTabs activeTab="overview" leagueId={league.id} isCommissioner={isCommissioner} />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowLeaveModal(true)}
          disabled={isCommissioner}
          title={
            isCommissioner
              ? "Commissioner cannot leave - delete league or transfer ownership"
              : "Leave this league"
          }
          className="rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Leave League
        </button>
      </div>

      {hasData ? (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 order-1 lg:order-2 lg:col-span-1">
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

            <div className="order-2 lg:order-1 lg:col-span-2">
              <StandingsTable standings={league.standings} userTeamId={league.userTeam.id} />
            </div>
          </div>
        </>
      ) : (
        <EmptyState message="No data available for this league" />
      )}

      {showLeaveModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h3 className="text-lg font-medium text-gray-900">Leave League?</h3>
            <p className="mt-2 text-sm text-gray-600">
              {isCommissioner
                ? "Commissioners cannot leave until they transfer league ownership."
                : `Leave ${league.name}? Your team will be permanently removed.`}
            </p>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLeaveLeague}
                disabled={isLeaving || isCommissioner}
                className="flex-1 rounded-full border border-red-300 bg-red-50 px-4 py-2 font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLeaving ? "Leaving..." : "Confirm Leave"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

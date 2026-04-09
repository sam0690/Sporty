"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMe } from "@/hooks/auth/useMe";
import { toastifier } from "@/libs/toastifier";
import { CurrentMatchup } from "@/components/dashboard/leagues/league-home/components/CurrentMatchup";
import { EmptyState } from "@/components/dashboard/leagues/league-home/components/EmptyState";
import {
  LeagueHeader,
  type Sport,
} from "@/components/dashboard/leagues/league-home/components/LeagueHeader";
import { NavigationTabs } from "@/components/dashboard/leagues/league-home/components/NavigationTabs";
import { StandingsTable } from "@/components/dashboard/leagues/league-home/components/StandingsTable";
import { WeekSelector } from "@/components/dashboard/leagues/league-home/components/WeekSelector";
import { YourScoreCard } from "@/components/dashboard/leagues/league-home/components/YourScoreCard";
import { TransferFields } from "@/components/dashboard/leagues/league-home/components/TransferFields";
import { CardSkeleton, TableSkeleton } from "@/components/ui/skeletons";
import { fetchTransferWindowStatus } from "@/lib/api/notifications";

import {
  useActiveWindow,
  useLeague,
  useLeaveLeague,
  useMyTeam,
} from "@/hooks/leagues/useLeagues";
import { useLeagueCompetitionMode } from "@/hooks/leagues/useLeagueCompetitionMode";

export function LeagueHome() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const leagueId = params?.id ?? "";

  const { data: league, isLoading: leagueLoading } = useLeague(leagueId);
  const {
    data: myTeam,
    isLoading: teamLoading,
    isError: myTeamMissing,
  } = useMyTeam(leagueId);
  const { data: activeWindow, isLoading: windowLoading } =
    useActiveWindow(leagueId);
  const leaveLeague = useLeaveLeague();
  const { username } = useMe();

  const [currentWeek, setCurrentWeek] = useState(1);
  const [windowStatusLoading, setWindowStatusLoading] = useState(false);
  const [isTransferWindowActive, setIsTransferWindowActive] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (activeWindow) {
      setCurrentWeek(activeWindow.number);
    }
  }, [activeWindow]);

  useEffect(() => {
    if (!leagueId) {
      setIsTransferWindowActive(false);
      return;
    }

    const run = async () => {
      setWindowStatusLoading(true);
      try {
        const status = await fetchTransferWindowStatus(leagueId);
        setIsTransferWindowActive(status.is_active);
      } catch {
        setIsTransferWindowActive(false);
      } finally {
        setWindowStatusLoading(false);
      }
    };

    void run();
  }, [leagueId]);

  const isCommissioner = league?.owner?.username === username;
  const { isDraftMode } = useLeagueCompetitionMode(league);
  const isBudgetMode = !isDraftMode;
  const hasMyTeam = Boolean(league?.my_team?.id || myTeam?.id);
  const leagueStatus = league?.status;
  const isLoading = leagueLoading || teamLoading || windowLoading;
  const leagueSport: Sport =
    league?.sports?.[0]?.sport.name === "basketball"
      ? league.sports[0].sport.name
      : "football";

  const handleLeaveLeague = async () => {
    if (!league) return;
    if (isCommissioner) {
      toastifier.error(
        "✕ Transfer commissioner role before leaving this league",
      );
      return;
    }

    setIsLeaving(true);
    try {
      await leaveLeague.mutateAsync(league.id);
      setShowLeaveModal(false);
      router.push("/leagues");
    } finally {
      setIsLeaving(false);
    }
  };

  if (isLoading) {
    return (
      <section className="max-w-6xl mx-auto px-6 py-8 space-y-6 font-[system-ui,-apple-system]">
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
    <section className="max-w-6xl mx-auto px-6 py-8 space-y-6 font-[system-ui,-apple-system] text-gray-900">
      <div className="text-sm text-gray-500">
        Manager: {username || "Sporty User"}
      </div>

      <LeagueHeader
        leagueName={league?.name || ""}
        sport={leagueSport}
        currentWeek={currentWeek}
        totalWeeks={activeWindow?.total_number || 16}
      />

      <WeekSelector
        currentWeek={currentWeek}
        totalWeeks={activeWindow?.total_number || 16}
        onWeekChange={(week) => {
          if (week < 1 || (activeWindow && week > activeWindow.total_number)) {
            return;
          }

          setCurrentWeek(week);
        }}
      />

      <NavigationTabs
        activeTab="overview"
        leagueId={leagueId}
        isCommissioner={isCommissioner}
      />

      {windowStatusLoading ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 text-sm text-gray-500">
          Checking transfer window status...
        </div>
      ) : isTransferWindowActive ? (
        <TransferFields leagueId={leagueId} />
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
          No transfer window is currently active for this league.
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowLeaveModal(true)}
          disabled={isCommissioner || isLeaving}
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

      {myTeam && league ? (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 order-1 lg:order-2 lg:col-span-1">
              <CurrentMatchup
                yourTeamName={myTeam.name}
                yourScore={0} // To be connected when scoring API is ready
                opponentTeamName="TBD"
                opponentScore={0}
              />
              <YourScoreCard yourScore={0} weeklyRank={0} pointsBehind={0} />
            </div>

            <div className="order-2 lg:order-1 lg:col-span-2">
              <StandingsTable
                standings={[]} // Will use Leaderboard API
                userTeamId={myTeam.id}
              />
            </div>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          {isDraftMode ? (
            leagueStatus === "setup" ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
                Draft has not started yet. Team creation happens through the
                draft only.
              </div>
            ) : leagueStatus === "drafting" ? (
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-900">
                Draft is in progress. Make your picks from the draft screen.
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 text-sm text-gray-700">
                Draft is complete, but your team is not available yet.
              </div>
            )
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
              Build your team to start competing in this budget league.
            </div>
          )}

          {league && isBudgetMode ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() =>
                  router.push(
                    hasMyTeam
                      ? `/leagues/${league.id}/lineup`
                      : `/leagues/${league.id}/create-team`,
                  )
                }
                className="rounded-full bg-primary-600 px-5 py-2 text-sm font-semibold text-white hover:bg-primary-700"
              >
                {hasMyTeam ? "View Team" : "Build Team"}
              </button>
            </div>
          ) : myTeamMissing && league ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => router.push(`/leagues/${league.id}/create-team`)}
                className="rounded-full bg-primary-600 px-5 py-2 text-sm font-semibold text-white hover:bg-primary-700"
              >
                Open Draft Screen
              </button>
            </div>
          ) : (
            <EmptyState message="No team data found for this league" />
          )}
        </div>
      )}

      {showLeaveModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h3 className="text-lg font-medium text-gray-900">Leave League?</h3>
            <p className="mt-2 text-sm text-gray-600">
              {isCommissioner
                ? "Commissioners cannot leave until they transfer league ownership."
                : `Leave ${league?.name || "this league"}? Your team will be permanently removed.`}
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

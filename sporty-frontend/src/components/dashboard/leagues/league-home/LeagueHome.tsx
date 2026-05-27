"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMe } from "@/hooks/auth/useMe";
import { useApiQuery } from "@/hooks/api/useApiQuery";
import { toastifier } from "@/lib/toastifier";
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
  const { data: transferWindowStatus, isLoading: transferWindowLoading } =
    useApiQuery(
      ["leagues", leagueId, "transfer-window", "status"],
      () => fetchTransferWindowStatus(leagueId),
      {
        enabled: !!leagueId,
      },
    );
  const leaveLeague = useLeaveLeague();
  const { username } = useMe();

  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const currentWeek = selectedWeek ?? activeWindow?.number ?? 1;
  const isTransferWindowActive = transferWindowStatus?.is_active ?? false;

  const isCommissioner = league?.owner?.username === username;
  const { isDraftMode } = useLeagueCompetitionMode(league);
  const isBudgetMode = !isDraftMode;
  const hasMyTeam = Boolean(league?.my_team?.id || myTeam?.id);
  const leagueStatus = league?.status;
  const isLoading =
    leagueLoading || teamLoading || windowLoading || transferWindowLoading;
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
        <div className="h-12 rounded-lg bg-accent/30 animate-pulse" />
        <div className="h-10 w-40 rounded-lg bg-accent/30 animate-pulse" />
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
    <section className="mx-auto max-w-6xl space-y-6 px-6 py-8 font-[system-ui,-apple-system,Segoe_UI,Roboto,sans-serif] text-foreground">
      <div className="text-sm text-slate-400">
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

          setSelectedWeek(week);
        }}
      />

      <NavigationTabs
        activeTab="overview"
        leagueId={leagueId}
        isCommissioner={isCommissioner}
      />

      {transferWindowLoading ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400 backdrop-blur-xl">
          Checking transfer window status...
        </div>
      ) : isTransferWindowActive ? (
        <TransferFields leagueId={leagueId} />
      ) : (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400 backdrop-blur-xl">
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
          className="rounded-full border border-red-500/20 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
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
              <div className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-5 text-sm text-amber-200">
                Draft has not started yet. Team creation happens through the
                draft only.
              </div>
            ) : leagueStatus === "drafting" ? (
              <div className="rounded-3xl border border-accent-primary/20 bg-accent-primary/10 p-5 text-sm text-accent-primary">
                Draft is in progress. Make your picks from the draft screen.
              </div>
            ) : (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-slate-300 backdrop-blur-xl">
                Draft is complete, but your team is not available yet.
              </div>
            )
          ) : (
            <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-5 text-sm text-emerald-200">
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
                      : `/create-team?leagueId=${league.id}`,
                  )
                }
                className="rounded-full bg-linear-to-r from-accent-primary to-accent-secondary px-5 py-2 text-sm font-semibold text-slate-950 hover:brightness-110"
              >
                {hasMyTeam ? "View Team" : "Build Team"}
              </button>
            </div>
          ) : myTeamMissing && league ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() =>
                  router.push(`/create-team?leagueId=${league.id}`)
                }
                className="rounded-full bg-linear-to-r from-accent-primary to-accent-secondary px-5 py-2 text-sm font-semibold text-slate-950 hover:brightness-110"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xl">
          <div className="w-full max-w-md rounded-4xl border border-white/10 bg-surface/90 p-6 shadow-[0_28px_80px_rgba(0,0,0,0.38)] backdrop-blur-xl">
            <h3 className="text-lg font-medium text-foreground">
              Leave League?
            </h3>
            <p className="mt-2 text-sm text-slate-400">
              {isCommissioner
                ? "Commissioners cannot leave until they transfer league ownership."
                : `Leave ${league?.name || "this league"}? Your team will be permanently removed.`}
            </p>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-foreground hover:bg-white/8"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLeaveLeague}
                disabled={isLeaving || isCommissioner}
                className="flex-1 rounded-full border border-red-500/20 bg-red-500/10 px-4 py-2 font-medium text-red-200 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
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

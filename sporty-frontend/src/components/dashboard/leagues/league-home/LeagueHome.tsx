"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMe } from "@/hooks/auth/useMe";
import { toastifier } from "@/lib/toastifier";
import { CurrentMatchup } from "@/components/dashboard/leagues/league-home/components/CurrentMatchup";
import { EmptyState } from "@/components/dashboard/leagues/league-home/components/EmptyState";
import {
  LeagueHeader,
  type Sport,
} from "@/components/dashboard/leagues/league-home/components/LeagueHeader";
import { NavigationTabs } from "@/components/dashboard/leagues/league-home/components/NavigationTabs";
import { StandingsTable } from "@/components/dashboard/leagues/league-home/components/StandingsTable";
import { YourScoreCard } from "@/components/dashboard/leagues/league-home/components/YourScoreCard";
import { TransferFields } from "@/components/dashboard/leagues/league-home/components/TransferFields";
import { GameweekBreakdown } from "@/components/dashboard/main-dashboard/components/GameweekBreakdown";
import { CardSkeleton, TableSkeleton } from "@/components/ui/skeletons";

import {
  useActiveWindow,
  useEditableWindow,
  useLeaderboard,
  useLeague,
  useLeaveLeague,
  useMyTeam,
} from "@/hooks/leagues/useLeagues";
import { useDashboardLeagueStats } from "@/hooks/dashboard/useDashboardData";
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
  // Transfers/lineups edit the next not-yet-locked gameweek; the quick-transfer
  // widget is open while that window's transfer deadline hasn't passed.
  const { data: editableWindow, isLoading: transferWindowLoading } =
    useEditableWindow(leagueId);
  const leaveLeague = useLeaveLeague();
  const { username } = useMe();

  // The overview is a snapshot of the running gameweek; browsing other
  // gameweeks lives on the leaderboard page, so there's no week selector here.
  const currentWeek = activeWindow?.number ?? 1;

  // Season standings (total points) and the running gameweek's board (per-week
  // points + rank) power the standings table, your-score card and the
  // you-vs-leader matchup. The per-gameweek breakdown comes from the league
  // dashboard stats. The week board is scoped to the active gameweek via
  // `gameweek`, resolved to the season's transfer window server-side.
  const { data: seasonBoard, isLoading: seasonBoardLoading } =
    useLeaderboard(leagueId);
  const { data: weekBoard } = useLeaderboard(
    leagueId,
    undefined,
    false,
    currentWeek,
  );
  const { data: leagueStats, isLoading: leagueStatsLoading } =
    useDashboardLeagueStats(leagueId);

  const weekStanding = useMemo(() => {
    const entries = [...(weekBoard?.entries ?? [])].sort(
      (a, b) => Number(b.points) - Number(a.points),
    );
    const myEntry = entries.find((e) => e.team_id === myTeam?.id) ?? null;
    const leader = entries[0] ?? null;
    const youAreLeader =
      !!myEntry && !!leader && myEntry.team_id === leader.team_id;
    const opponent = youAreLeader ? (entries[1] ?? null) : leader;
    const yourScore = Math.round(Number(myEntry?.points ?? 0));
    const opponentScore = Math.round(Number(opponent?.points ?? 0));
    const weeklyRank =
      myEntry?.rank ??
      (myEntry ? entries.indexOf(myEntry) + 1 : 0);
    const pointsBehind = leader
      ? Math.max(0, Math.round(Number(leader.points) - Number(myEntry?.points ?? 0)))
      : 0;
    return {
      youAreLeader,
      hasOpponent: !!opponent,
      opponentName: opponent?.team_name ?? "",
      yourScore,
      opponentScore,
      weeklyRank,
      pointsBehind,
    };
  }, [weekBoard, myTeam?.id]);

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const isTransferWindowActive = useMemo(() => {
    if (!editableWindow?.transfer_deadline_at) return false;
    if (editableWindow.transfers_locked) return false;
    return Date.now() <= new Date(editableWindow.transfer_deadline_at).getTime();
  }, [editableWindow]);

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
      toastifier.error("Transfer commissioner role before leaving this league");
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
      <section className="mx-auto max-w-6xl space-y-4 px-6 py-8">
        <div className="h-12 animate-pulse rounded-[3px] bg-[#F3F4F7]" />
        <div className="h-10 w-40 animate-pulse rounded-[3px] bg-[#F3F4F7]" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2"><TableSkeleton /></div>
          <div className="space-y-4 lg:col-span-1">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl space-y-5 px-6 py-8 text-[#0B1220]">
      <p className="section-label">Manager: {username || "Sporty User"}</p>

      <LeagueHeader
        leagueName={league?.name || ""}
        sport={leagueSport}
        currentWeek={currentWeek}
        totalWeeks={activeWindow?.total_number || 16}
      />

      <NavigationTabs
        activeTab="overview"
        leagueId={leagueId}
        isCommissioner={isCommissioner}
      />

      <TransferFields
        leagueId={leagueId}
        isOpen={isTransferWindowActive}
        isLoading={transferWindowLoading}
        window={editableWindow}
      />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowLeaveModal(true)}
          disabled={isCommissioner || isLeaving}
          title={
            isCommissioner
              ? "Commissioner cannot leave — delete league or transfer ownership"
              : "Leave this league"
          }
          className="rounded-[3px] border border-[rgba(255,59,48,0.3)] bg-transparent px-4 py-2 font-barlow-condensed text-xs font-bold uppercase tracking-[2px] text-[#DC2626] transition-colors hover:bg-[rgba(255,59,48,0.1)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Leave League
        </button>
      </div>

      {myTeam && league ? (
        <div className="space-y-5">
          <GameweekBreakdown
            breakdown={leagueStats?.gameweek_breakdown ?? []}
            isLoading={leagueStatsLoading}
          />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="space-y-5 order-1 lg:order-2 lg:col-span-1">
              <CurrentMatchup
                yourTeamName={myTeam.name}
                yourScore={weekStanding.yourScore}
                opponentTeamName={weekStanding.opponentName}
                opponentScore={weekStanding.opponentScore}
                youAreLeader={weekStanding.youAreLeader}
                hasOpponent={weekStanding.hasOpponent}
              />
              <YourScoreCard
                yourScore={weekStanding.yourScore}
                weeklyRank={weekStanding.weeklyRank}
                pointsBehind={weekStanding.pointsBehind}
              />
            </div>
            <div className="order-2 lg:order-1 lg:col-span-2">
              <StandingsTable
                entries={seasonBoard?.entries ?? []}
                userTeamId={myTeam.id}
                isLoading={seasonBoardLoading}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {isDraftMode ? (
            leagueStatus === "setup" ? (
              <div className="alert-deadline">
                Draft has not started yet. Team creation happens through the draft only.
              </div>
            ) : leagueStatus === "drafting" ? (
              <div className="rounded-[3px] border border-[rgba(0,212,255,0.3)] bg-[#1a1a2a] p-5 text-sm text-[#0891B2]">
                Draft is in progress. Make your picks from the draft screen.
              </div>
            ) : (
              <div className="rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] p-5 text-sm text-[#6B7280]">
                Draft is complete, but your team is not available yet.
              </div>
            )
          ) : (
            <div className="rounded-[3px] border border-[rgba(76,175,80,0.3)] bg-[#1a2a1a] p-5 text-sm text-[#16A34A]">
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
                className="rounded-[3px] bg-[#DC2626] px-5 py-2 font-barlow-condensed text-xs font-bold uppercase tracking-[2px] text-[#F6F7F9] transition-colors hover:bg-[#B91C1C]"
              >
                {hasMyTeam ? "View Team" : "Build Team"}
              </button>
            </div>
          ) : myTeamMissing && league ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => router.push(`/create-team?leagueId=${league.id}`)}
                className="rounded-[3px] bg-[#DC2626] px-5 py-2 font-barlow-condensed text-xs font-bold uppercase tracking-[2px] text-[#F6F7F9] transition-colors hover:bg-[#B91C1C]"
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !isLeaving) setShowLeaveModal(false);
          }}
        >
          <div className="w-full max-w-md rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] p-6">
            <h3 className="font-barlow-condensed text-xl font-bold uppercase tracking-[2px] text-[#0B1220]">
              Leave League?
            </h3>
            <p className="mt-2 text-sm text-[#6B7280]">
              {isCommissioner
                ? "Commissioners cannot leave until they transfer league ownership."
                : `Leave ${league?.name || "this league"}? Your team will be permanently removed.`}
            </p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="flex-1 rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-transparent px-4 py-2 font-barlow-condensed text-xs font-bold uppercase tracking-[2px] text-[#6B7280] transition-colors hover:text-[#0B1220]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLeaveLeague}
                disabled={isLeaving || isCommissioner}
                className="flex-1 rounded-[3px] bg-[#DC2626] px-4 py-2 font-barlow-condensed text-xs font-bold uppercase tracking-[2px] text-white transition-colors hover:bg-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-60"
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

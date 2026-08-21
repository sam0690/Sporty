"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useMe } from "@/hooks/auth/useMe";
import { ConfirmDialog, EmptyState, ErrorState } from "@/components/ui";
import { toastifier } from "@/lib/toastifier";
import { CurrentMatchup } from "./components/CurrentMatchup";
import { getLeagueCta, type LeagueDraftStatus } from "./leagueCta";
import {
  StandingsTable,
  type StandingRow,
} from "@/features/leagues/components/StandingsTable";
import {
  notScoringReason,
  sortLeaderboardEntries,
} from "@/features/leagues/leaderboardRows";
import { YourScoreCard } from "./components/YourScoreCard";
import { TransferFields } from "./components/TransferFields";
import { GameweekBreakdown } from "@/features/dashboard/components/GameweekBreakdown";
import { CardSkeleton, TableSkeleton } from "@/components/ui/skeletons";

import {
  useEditableWindow,
  useLeaderboard,
  useLeague,
  useLeaveLeague,
  useMyTeam,
  useSeasonState,
  useStartDraft,
} from "@/hooks/leagues/useLeagues";
import { useDashboardLeagueStats } from "@/hooks/dashboard/useDashboardData";
import { useLeagueCompetitionMode } from "@/hooks/leagues/useLeagueCompetitionMode";
import { useLeagueDraftStream } from "@/hooks/leagues/useLeagueDraftStream";

export function LeagueHome() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const leagueId = params?.id ?? "";

  const {
    data: league,
    isLoading: leagueLoading,
    isError: leagueError,
  } = useLeague(leagueId);
  const {
    data: myTeam,
    isLoading: teamLoading,
    isError: myTeamMissing,
  } = useMyTeam(leagueId);
  const { data: seasonState, isLoading: windowLoading } =
    useSeasonState(leagueId);
  // Transfers/lineups edit the next not-yet-locked gameweek; the quick-transfer
  // widget is open while that window's transfer deadline hasn't passed.
  const { data: editableWindow, isLoading: transferWindowLoading } =
    useEditableWindow(leagueId);
  const leaveLeague = useLeaveLeague();
  const startDraft = useStartDraft();
  const { username } = useMe();

  // The overview is a snapshot of the running gameweek; browsing other
  // gameweeks lives on the leaderboard page, so there's no week selector here.
  // From season-state, not active-window: the latter 409s whenever no gameweek
  // is in progress, and between gameweeks this gives the last one played
  // instead of falling back to GW 1.
  const currentWeek = seasonState?.current_gw || 1;

  // The overview's standings table shows the running gameweek's board (per-week
  // points + rank), not the season total — that lives on the leaderboard/table
  // page. Same board also powers the your-score card and the you-vs-leader
  // matchup. It's scoped to the active gameweek via `gameweek`, resolved to
  // the season's transfer window server-side.
  const { data: weekBoard, isLoading: weekBoardLoading } = useLeaderboard(
    leagueId,
    undefined,
    false,
    currentWeek,
  );
  // Backend rank can be null until the ranking job runs; fall back to
  // position in points-sorted order so the list always shows a standing.
  // Non-scoring managers (no squad, or a midseason joiner whose first window
  // hasn't opened) sort last and keep a null rank — they must not land at
  // position 0 and read as league leader while everyone is still on zero.
  const standings = useMemo<StandingRow[]>(() => {
    const entries = weekBoard?.entries ?? [];
    return sortLeaderboardEntries(entries, currentWeek).map((entry, index) => {
      const idle = notScoringReason(entry, currentWeek);
      return {
        // Scoring rows occupy indices 0..n-1 (the sort guarantees it), so the
        // index doubles as the fallback rank without a running counter.
        rank: idle ? null : (entry.rank ?? index + 1),
        teamId: entry.team_id,
        teamName: entry.team_name,
        manager: entry.owner_name,
        points: Number(entry.points),
        pointsDeducted: Number(entry.points_deducted),
        penalties: entry.penalties?.map((p) => ({
          points_charged: Number(p.points_charged),
          reason: p.reason,
          created_at: p.created_at,
        })),
        notScoringReason: idle ?? undefined,
        eligibleFromGameweek: entry.eligible_from_gameweek,
      };
    });
  }, [weekBoard, currentWeek]);
  const {
    data: leagueStats,
    isLoading: leagueStatsLoading,
    error: leagueStatsError,
  } = useDashboardLeagueStats(leagueId);

  // Derived from `standings`, not the raw entries: that list is already sorted
  // with non-scoring managers last, so the leader can't be someone who has no
  // squad. `scoring[0]` (not `entries[0]`) for the same reason — in a league
  // where nobody is scoring yet there is no leader to name.
  const weekStanding = useMemo(() => {
    const scoring = standings.filter((row) => !row.notScoringReason);
    const myRow = standings.find((row) => row.teamId === myTeam?.id) ?? null;
    const leader = scoring[0] ?? null;
    const youAreLeader = !!myRow && !!leader && myRow.teamId === leader.teamId;
    const opponent = youAreLeader ? (scoring[1] ?? null) : leader;
    return {
      youAreLeader,
      hasOpponent: !!opponent,
      opponentName: opponent?.teamName ?? "",
      yourScore: Math.round(myRow?.points ?? 0),
      opponentScore: Math.round(opponent?.points ?? 0),
      weeklyRank: myRow?.rank ?? 0,
      pointsBehind: leader
        ? Math.max(0, Math.round(leader.points - (myRow?.points ?? 0)))
        : 0,
    };
  }, [standings, myTeam?.id]);

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const isTransferWindowActive = useMemo(() => {
    if (!editableWindow?.transfer_deadline_at) return false;
    if (editableWindow.transfers_locked) return false;
    // eslint-disable-next-line react-hooks/purity -- wall-clock deadline check; intentionally re-evaluated when the window data changes
    return Date.now() <= new Date(editableWindow.transfer_deadline_at).getTime();
  }, [editableWindow]);

  const isCommissioner = league?.owner?.username === username;
  const { isDraftMode } = useLeagueCompetitionMode(league);
  const isBudgetMode = !isDraftMode;
  const hasMyTeam = Boolean(league?.my_team?.id || myTeam?.id);
  const leagueStatus = league?.status;
  const isLoading =
    leagueLoading || teamLoading || windowLoading || transferWindowLoading;

  const draftStatus: LeagueDraftStatus =
    leagueStatus === "setup"
      ? "setup"
      : leagueStatus === "drafting"
        ? "drafting"
        : "complete";
  const cta = getLeagueCta({
    competitionType: isDraftMode ? "draft" : "budget",
    draftStatus,
    isCommissioner,
    hasTeam: isBudgetMode ? hasMyTeam : !myTeamMissing,
  });

  // Draft rooms are member-scoped: once a draft league is DRAFTING, everyone
  // belongs in the draft screen. `replace` (not push) keeps the back button
  // from bouncing users straight back into the overview they're leaving.
  const goToDraftRoom = useCallback(() => {
    router.replace(`/leagues/${leagueId}/create-team`);
  }, [router, leagueId]);

  // Reload-safe guard: members AND the commissioner who land on (or reload) the
  // overview while the draft is running are taken to the draft room.
  useEffect(() => {
    if (isDraftMode && leagueStatus === "drafting") {
      goToDraftRoom();
    }
  }, [isDraftMode, leagueStatus, goToDraftRoom]);

  // Live fan-out (SSE, no polling): members waiting in the SETUP room follow the
  // commissioner into the draft the instant it starts.
  useLeagueDraftStream(
    leagueId,
    isDraftMode && leagueStatus === "setup",
    goToDraftRoom,
  );

  // Entering DRAFTING for a draft league must go through start_draft, which
  // assigns draft positions + creates every member's team before flipping the
  // league to the drafting phase. On success we drop the commissioner straight
  // into the draft room.
  const handleStartDraft = async () => {
    if (!league) return;
    try {
      await startDraft.mutateAsync(league.id);
      router.push(`/leagues/${league.id}/create-team`);
    } catch {
      // errors are surfaced by the shared mutation toast
    }
  };

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
      <section className="space-y-4">
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

  // A failed league fetch must not fall through to the CTA branch below —
  // it would misread as "you have no team in this league".
  if (leagueError || !league) {
    return <ErrorState title="Failed to load league" />;
  }

  return (
    <section className="space-y-5">
      {isBudgetMode ? (
        <TransferFields
          leagueId={leagueId}
          isOpen={isTransferWindowActive}
          isLoading={transferWindowLoading}
          window={editableWindow}
        />
      ) : (
        <section className="flex flex-col gap-3 card-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="section-label">Roster Moves</span>
            <p className="mt-2 text-sm text-fg-2">
              {leagueStatus === "active"
                ? "Pick up unowned players from the free-agent pool (add one, drop one)."
                : "No budget transfers in a draft league. Free agents open once the season is underway."}
            </p>
          </div>
          {leagueStatus === "active" ? (
            <Link
              href={`/leagues/${leagueId}/free-agents`}
              className="inline-flex shrink-0 items-center justify-center rounded-[3px] border border-white/12 px-5 py-2.5 font-sans text-xs font-700 uppercase tracking-[1.5px] text-fg-1 transition-colors hover:border-accent/40 hover:text-accent"
            >
              Free Agents
            </Link>
          ) : null}
        </section>
      )}

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
          aria-label="Leave league"
          className="rounded-[3px] border border-white/8 p-2 text-fg-3 transition-colors hover:border-[rgba(255,59,48,0.3)] hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {myTeam && league ? (
        <div className="space-y-5">
          <GameweekBreakdown
            breakdown={leagueStats?.gameweek_breakdown ?? []}
            isLoading={leagueStatsLoading}
            isError={Boolean(leagueStatsError)}
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
                preSeason={seasonState?.phase === "PRE_SEASON"}
              />
            </div>
            <div className="order-2 lg:order-1 lg:col-span-2 space-y-2">
              <div className="flex justify-end">
                <Link
                  href={`/leagues/${leagueId}/leaderboard`}
                  className="font-sans text-xs font-700 uppercase tracking-[1.5px] text-fg-3 transition-colors hover:text-accent"
                >
                  View Full Table
                </Link>
              </div>
              <StandingsTable
                standings={standings}
                userTeamId={myTeam.id}
                isLoading={weekBoardLoading}
                pointsLabel={`Gameweek ${currentWeek} Standings`}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {cta.banner.tone === "success" ? (
            <div className="rounded-[3px] border border-success/30 bg-[#1a2a1a] p-5 text-sm text-success">
              {cta.banner.message}
            </div>
          ) : cta.banner.tone === "neutral" ? (
            <div className="rounded-[3px] border border-white/8 bg-surface-3 p-5 text-sm text-fg-3">
              {cta.banner.message}
            </div>
          ) : (
            <div
              className={
                cta.banner.tone === "warning"
                  ? "alert-deadline flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                  : "flex flex-col gap-3 rounded-[3px] border border-info/30 bg-[#1a1a2a] p-5 text-sm text-info sm:flex-row sm:items-center sm:justify-between"
              }
            >
              <span>{cta.banner.message}</span>
              {cta.banner.action === "startDraft" ? (
                <button
                  type="button"
                  onClick={handleStartDraft}
                  disabled={startDraft.isPending}
                  className="shrink-0 rounded-[3px] bg-accent px-5 py-2 font-sans text-xs font-700 uppercase tracking-[2px] text-surface-0 transition-colors hover:bg-accent-bright disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {startDraft.isPending ? "Starting…" : "Start Draft"}
                </button>
              ) : cta.banner.action === "enterDraftRoom" ? (
                <button
                  type="button"
                  onClick={goToDraftRoom}
                  className="shrink-0 rounded-[3px] bg-info px-5 py-2 font-sans text-xs font-700 uppercase tracking-[2px] text-surface-0 transition-colors hover:bg-[#4de0ff]"
                >
                  Enter Draft Room
                </button>
              ) : null}
            </div>
          )}

          {league && cta.primary.kind === "buildOrViewTeam" ? (
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
                className="rounded-[3px] bg-accent px-5 py-2 font-sans text-xs font-700 uppercase tracking-[2px] text-surface-0 transition-colors hover:bg-accent-bright"
              >
                {cta.primary.label}
              </button>
            </div>
          ) : league && cta.primary.kind === "openDraftScreen" ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => router.push(`/leagues/${league.id}/create-team`)}
                className="rounded-[3px] bg-accent px-5 py-2 font-sans text-xs font-700 uppercase tracking-[2px] text-surface-0 transition-colors hover:bg-accent-bright"
              >
                Open Draft Screen
              </button>
            </div>
          ) : (
            <EmptyState title="No team data found for this league" />
          )}
        </div>
      )}

      <ConfirmDialog
        open={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        onConfirm={handleLeaveLeague}
        loading={isLeaving}
        confirmDisabled={isCommissioner}
        title="Leave League?"
        message={
          isCommissioner
            ? "Commissioners cannot leave until they transfer league ownership."
            : `Leave ${league?.name || "this league"}? Your team will be permanently removed.`
        }
        confirmLabel="Confirm Leave"
      />
    </section>
  );
}

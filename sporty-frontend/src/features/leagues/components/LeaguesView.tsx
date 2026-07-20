"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useMyLeagues } from "@/hooks/leagues/useLeagues";
import { useRelativeTime } from "@/hooks/general/useRelativeTime";
import {
  LeagueRow,
  type LeagueRowItem,
  type LeagueRowState,
  type Sport,
} from "./LeagueRow";
import { EmptyState, ErrorState, PageHeader } from "@/components/ui";
import { Trophy } from "lucide-react";
import { PlayerCardSkeleton } from "@/components/ui/skeletons";

type Group = {
  key: LeagueRowState;
  label: string;
  hint: string;
  leagues: LeagueRowItem[];
};

// Order matters — this is the triage order the page renders top to bottom.
const GROUP_ORDER: { key: LeagueRowState; label: string; hint: string }[] = [
  { key: "action", label: "Needs action", hint: "Set your lineup before it locks" },
  { key: "live", label: "Live now", hint: "A gameweek is in progress" },
  { key: "settled", label: "Your leagues", hint: "Nothing needs you right now" },
];

function deriveState(league: LeagueRowItem, nowMs: number): LeagueRowState {
  if (league.live) return "live";
  const deadlineMs = league.lineupDeadlineAt
    ? new Date(league.lineupDeadlineAt).getTime()
    : null;
  const editable = deadlineMs != null && deadlineMs > nowMs;
  if (editable && !league.hasLineup) return "action";
  return "settled";
}

export function LeaguesView() {
  const { data: leaguesData, isLoading, isError } = useMyLeagues();
  // One shared clock for every row's countdown / live derivation.
  const nowMs = useRelativeTime({ refreshIntervalMs: 30_000 });

  const leagues: LeagueRowItem[] = useMemo(
    () =>
      (leaguesData || []).map((l) => ({
        id: l.id,
        name: l.name,
        // A league with more than one sport is multisport, not its first sport.
        sport:
          (l.sports?.length ?? 0) > 1
            ? ("multisport" as Sport)
            : ((l.sports?.[0]?.sport.name as Sport) || "multisport"),
        teamName: l.my_team?.name || "No team yet",
        memberCount: l.member_count,
        rank: l.my_team?.rank ?? 0,
        points: Number(l.my_team?.points ?? 0),
        lineupDeadlineAt: l.my_team?.lineup_deadline_at ?? null,
        hasLineup: Boolean(l.my_team?.has_lineup),
        live: Boolean(l.my_team?.live),
      })),
    [leaguesData],
  );

  const groups: Group[] = useMemo(() => {
    const buckets: Record<LeagueRowState, LeagueRowItem[]> = {
      action: [],
      live: [],
      settled: [],
    };
    for (const league of leagues) {
      buckets[deriveState(league, nowMs)].push(league);
    }
    // Action: soonest deadline first. Others: best rank first (unranked last).
    buckets.action.sort(
      (a, b) =>
        new Date(a.lineupDeadlineAt ?? 0).getTime() -
        new Date(b.lineupDeadlineAt ?? 0).getTime(),
    );
    const byRank = (a: LeagueRowItem, b: LeagueRowItem) =>
      (a.rank || Infinity) - (b.rank || Infinity) || b.points - a.points;
    buckets.live.sort(byRank);
    buckets.settled.sort(byRank);

    return GROUP_ORDER.map((g) => ({ ...g, leagues: buckets[g.key] })).filter(
      (g) => g.leagues.length > 0,
    );
  }, [leagues, nowMs]);

  // A single league doesn't need triage headers — just show the row.
  const showGroupHeaders = leagues.length > 1 && groups.length > 0;
  let rowIndex = 0;

  return (
    <section className="mx-auto max-w-4xl px-4 py-8 text-fg-1 sm:px-6 lg:py-10">
      <PageHeader
        title="My Leagues"
        subtitle="What needs you, first"
        actions={
          <>
            <Link
              href="/join-league"
              className="rounded-[3px] border border-accent/40 bg-transparent px-4 py-2 font-sans text-xs font-700 uppercase tracking-[2px] text-accent transition-colors hover:bg-accent/10"
            >
              Join League
            </Link>
            <Link
              href="/create-league"
              className="rounded-[3px] bg-accent px-4 py-2 font-sans text-xs font-700 uppercase tracking-[2px] text-surface-0 transition-colors hover:bg-accent-bright"
            >
              Create League
            </Link>
          </>
        }
      />

      <div className="mt-8">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }, (_, index) => (
              <PlayerCardSkeleton key={index} />
            ))}
          </div>
        ) : isError ? (
          <ErrorState title="Failed to load your leagues" />
        ) : leagues.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No leagues yet"
            description="Join a league to start playing"
            actions={[
              { label: "Join League", href: "/join-league", variant: "primary" },
              { label: "Create League", href: "/create-league", variant: "secondary" },
            ]}
          />
        ) : (
          <div className="space-y-8">
            {groups.map((group) => (
              <div key={group.key} className="space-y-2.5">
                {showGroupHeaders && (
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="section-label">{group.label}</h2>
                    <span className="hidden text-xs text-fg-3 sm:block">
                      {group.hint}
                    </span>
                  </div>
                )}
                <div className="space-y-2">
                  {group.leagues.map((league) => (
                    <LeagueRow
                      key={league.id}
                      league={league}
                      state={group.key}
                      nowMs={nowMs}
                      animationDelay={rowIndex++ * 60}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

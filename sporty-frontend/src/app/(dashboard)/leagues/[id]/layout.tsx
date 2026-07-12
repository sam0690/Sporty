"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

import { PageContainer } from "@/components/ui";
import {
  LeagueShellHeader,
  LeagueTabs,
  type Sport,
} from "@/features/leagues/league-shell";
import { useMe } from "@/hooks/auth/useMe";
import { useActiveWindow, useLeague } from "@/hooks/leagues/useLeagues";
import { useLeagueCompetitionMode } from "@/hooks/leagues/useLeagueCompetitionMode";
import { setLastActiveLeagueId } from "@/lib/storage.index";

export default function LeagueLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams<{ id: string }>();
  const leagueId = params?.id ?? "";
  const pathname = usePathname();
  // The draft-room entry point is a full-bleed flow (its own header, step
  // indicators, live draft board) that doesn't belong in any of the league
  // tabs — keep it living at this URL for a real deep link, but skip the
  // shell chrome around it rather than showing a tab bar with nothing active.
  const isCreateTeamRoute = pathname?.endsWith("/create-team") ?? false;

  const { data: league, isLoading, isError } = useLeague(leagueId);
  const { data: activeWindow } = useActiveWindow(leagueId);
  const { username } = useMe();
  const { isDraftMode } = useLeagueCompetitionMode(league);

  const isCommissioner = league?.owner?.username === username;
  const sport: Sport =
    league?.sports?.[0]?.sport.name === "basketball" ? "basketball" : "football";

  useEffect(() => {
    if (leagueId) {
      setLastActiveLeagueId(leagueId);
    }
  }, [leagueId]);

  if (isError) {
    return (
      <PageContainer size="wide">
        <div className="card-surface flex flex-col items-center gap-4 p-10 text-center">
          <h1 className="font-sans text-xl font-700 uppercase tracking-[2px] text-fg-1">
            League not found
          </h1>
          <p className="text-sm text-fg-3">
            This league doesn&apos;t exist or you don&apos;t have access to it.
          </p>
          <Link
            href="/leagues"
            className="rounded-[3px] bg-accent px-5 py-2 font-sans text-xs font-700 uppercase tracking-[2px] text-surface-0 transition-colors hover:bg-accent-bright"
          >
            Back to Leagues
          </Link>
        </div>
      </PageContainer>
    );
  }

  if (isCreateTeamRoute) {
    return <>{children}</>;
  }

  return (
    <PageContainer size="wide" className="text-fg-1">
      {league ? (
        <>
          <LeagueShellHeader
            leagueName={league.name}
            sport={sport}
            currentWeek={activeWindow?.number ?? 1}
            totalWeeks={activeWindow?.total_number || 16}
            isDraftMode={isDraftMode}
          />
          <LeagueTabs
            leagueId={leagueId}
            isDraftMode={isDraftMode}
            isCommissioner={isCommissioner}
            isHeadToHead={!!league.is_head_to_head}
          />
        </>
      ) : isLoading ? (
        <div className="mb-6 space-y-5" aria-hidden>
          <div className="h-36 animate-pulse rounded-[3px] bg-surface-3" />
          <div className="h-12 animate-pulse rounded-[3px] bg-surface-3" />
        </div>
      ) : null}
      {children}
    </PageContainer>
  );
}

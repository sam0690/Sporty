"use client";

import Link from "next/link";
import { useMe } from "@/hooks/auth/useMe";
import { useMyLeagues } from "@/hooks/leagues/useLeagues";
import {
  LeagueCard,
  type Sport,
} from "@/features/leagues/components/LeagueCard";
import { StatsRow } from "@/features/leagues/components/StatsRow";
import { EmptyState, PageHeader } from "@/components/ui";
import { Trophy } from "lucide-react";
import { LeagueCardSkeleton } from "@/components/ui/skeletons";

export function LeaguesView() {
  const { username } = useMe();
  const { data: leaguesData, isLoading } = useMyLeagues();

  const userName = username || "Sporty User";

  const leagues = (leaguesData || []).map((l) => ({
    id: l.id,
    name: l.name,
    // A league with more than one sport is multisport, not its first sport.
    sport:
      (l.sports?.length ?? 0) > 1
        ? ("multisport" as Sport)
        : ((l.sports?.[0]?.sport.name as Sport) || "multisport"),
    memberCount: l.member_count,
    yourRank: l.my_team?.rank ?? 0,
    teamName: l.my_team?.name || "No Team",
    points: Number(l.my_team?.points ?? 0),
  }));

  const rankedPositions = leagues
    .map((l) => l.yourRank)
    .filter((rank) => rank > 0);

  const stats = {
    totalLeagues: leagues.length,
    highestRank: rankedPositions.length ? Math.min(...rankedPositions) : 0,
    // Round the client-side sum: adding backend-rounded floats reintroduces
    // FP noise (0 + 55.2 + 9 + 29.6 + 5 === 98.80000000000001).
    totalPoints: Math.round(leagues.reduce((sum, l) => sum + l.points, 0) * 10) / 10,
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 text-fg-1 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        eyebrow={`Welcome back, ${userName}`}
        title="My Leagues"
        subtitle="Your fantasy leagues at a glance"
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
        <StatsRow
          totalLeagues={stats.totalLeagues}
          highestRank={stats.highestRank}
          totalPoints={stats.totalPoints}
        />
      </div>

      <div className="mt-8">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <LeagueCardSkeleton key={index} />
            ))}
          </div>
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
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {leagues.map((league, index) => (
              <LeagueCard
                key={league.id}
                id={league.id}
                name={league.name}
                sport={league.sport}
                memberCount={league.memberCount}
                yourRank={league.yourRank}
                teamName={league.teamName}
                points={league.points}
                animationDelay={index * 70}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

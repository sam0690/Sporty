"use client";

import { useMe } from "@/hooks/auth/useMe";
import { useMyLeagues } from "@/hooks/leagues/useLeagues";
import {
  LeagueCard,
  type Sport,
} from "@/components/dashboard/leagues/components/LeagueCard";
import { LeaguesHeader } from "@/components/dashboard/leagues/components/LeaguesHeader";
import { StatsRow } from "@/components/dashboard/leagues/components/StatsRow";
import { EmptyLeagues } from "@/components/ui/empty-states";
import { LeagueCardSkeleton } from "@/components/ui/skeletons";

export function Leagues() {
  const { username } = useMe();
  const { data: leaguesData, isLoading } = useMyLeagues();

  const userName = username || "Sporty User";

  // Map backend data to UI format
  const leagues = (leaguesData || []).map((l) => ({
    id: l.id,
    name: l.name,
    sport: (l.sports?.[0]?.sport.name as Sport) || "multisport",
    memberCount: l.member_count,
    yourRank: l.my_team?.rank || 0,
    teamName: l.my_team?.name || "No Team",
  }));

  const stats = {
    totalLeagues: leagues.length,
    highestRank: 0,
    totalPoints: 0,
  };

  return (
    <section className="mx-auto max-w-7xl bg-white px-6 py-12 text-black [font-family:system-ui,-apple-system,Segoe_UI,Roboto,sans-serif]">
      <LeaguesHeader userName={userName} />

      <div className="mt-8">
        <StatsRow
          totalLeagues={stats.totalLeagues}
          highestRank={stats.highestRank}
          totalPoints={stats.totalPoints}
        />
      </div>

      <div className="mt-8">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <LeagueCardSkeleton key={index} />
            ))}
          </div>
        ) : leagues.length === 0 ? (
          <EmptyLeagues />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {leagues.map((league, index) => (
              <LeagueCard
                key={league.id}
                id={league.id}
                name={league.name}
                sport={league.sport}
                memberCount={league.memberCount}
                yourRank={league.yourRank}
                teamName={league.teamName}
                animationDelay={index * 70}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

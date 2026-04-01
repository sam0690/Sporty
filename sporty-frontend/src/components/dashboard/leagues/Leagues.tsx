"use client";

import { useEffect, useState } from "react";
import { useMe } from "@/hooks/auth/useMe";
import {
  LeagueCard,
  type Sport,
} from "@/components/dashboard/leagues/components/LeagueCard";
import { LeaguesHeader } from "@/components/dashboard/leagues/components/LeaguesHeader";
import { StatsRow } from "@/components/dashboard/leagues/components/StatsRow";
import { EmptyLeagues } from "@/components/ui/empty-states";
import { LeagueCardSkeleton } from "@/components/ui/skeletons";

type League = {
  id: number;
  name: string;
  sport: Sport;
  memberCount: number;
  yourRank: number;
  teamName: string;
};

const mockLeagues: League[] = [
  {
    id: 1,
    name: "Premier League Champions",
    sport: "football",
    memberCount: 12,
    yourRank: 3,
    teamName: "Goal Rush",
  },
  {
    id: 2,
    name: "NBA Fantasy 2025",
    sport: "basketball",
    memberCount: 8,
    yourRank: 1,
    teamName: "Dunk Masters",
  },
  {
    id: 3,
    name: "Cricket World Cup",
    sport: "cricket",
    memberCount: 10,
    yourRank: 7,
    teamName: "Six Hitters",
  },
  {
    id: 4,
    name: "Ultimate All-Stars",
    sport: "multisport",
    memberCount: 15,
    yourRank: 4,
    teamName: "CrossSport Kings",
  },
];

const mockStats = {
  totalLeagues: 4,
  highestRank: 1,
  totalPoints: 587,
};

export function Leagues() {
  const { username } = useMe();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timeout = window.setTimeout(() => setIsLoading(false), 450);
    return () => window.clearTimeout(timeout);
  }, []);

  const leagues = mockLeagues;
  const stats = mockStats;
  const userName = username || "Sporty User";

  return (
    <section className="mx-auto max-w-7xl bg-white px-6 py-12 text-gray-900 [font-family:system-ui,-apple-system,Segoe_UI,Roboto,sans-serif]">
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

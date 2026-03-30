"use client";

import { useAuth } from "@/context/auth-context";
import { EmptyState } from "@/components/dashboard/leagues/components/EmptyState";
import { LeagueCard, type Sport } from "@/components/dashboard/leagues/components/LeagueCard";
import { LeaguesHeader } from "@/components/dashboard/leagues/components/LeaguesHeader";
import { StatsRow } from "@/components/dashboard/leagues/components/StatsRow";

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
  const { user } = useAuth();

  const leagues = mockLeagues;
  const stats = mockStats;
  const userName = user?.name ?? "Sporty User";

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-text-primary">
      <LeaguesHeader userName={userName} />

      <div className="mt-8">
        <StatsRow
          totalLeagues={stats.totalLeagues}
          highestRank={stats.highestRank}
          totalPoints={stats.totalPoints}
        />
      </div>

      <div className="mt-6">
        {leagues.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {leagues.map((league) => (
              <LeagueCard
                key={league.id}
                id={league.id}
                name={league.name}
                sport={league.sport}
                memberCount={league.memberCount}
                yourRank={league.yourRank}
                teamName={league.teamName}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

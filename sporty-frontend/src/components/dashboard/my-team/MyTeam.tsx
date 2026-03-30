"use client";

import { useMemo } from "react";
import { useAuth } from "@/context/auth-context";
import { EmptyState } from "@/components/dashboard/my-team/components/EmptyState";
import { LeagueGroup } from "@/components/dashboard/my-team/components/LeagueGroup";
import { TeamHeader } from "@/components/dashboard/my-team/components/TeamHeader";
import type { Sport } from "@/components/dashboard/my-team/components/PlayerCard";

type TeamLeague = {
  leagueId: number;
  leagueName: string;
  sport: Sport;
  players: {
    id: number;
    name: string;
    position: string;
    totalPoints: number;
    avgPoints: number;
  }[];
};

const mockTeams: TeamLeague[] = [
  {
    leagueId: 1,
    leagueName: "Premier League Champions",
    sport: "football",
    players: [
      { id: 1, name: "Lionel Messi", position: "Forward", totalPoints: 87, avgPoints: 9.2 },
      { id: 2, name: "Cristiano Ronaldo", position: "Forward", totalPoints: 76, avgPoints: 8.4 },
      { id: 3, name: "Kevin De Bruyne", position: "Midfielder", totalPoints: 65, avgPoints: 7.2 },
    ],
  },
  {
    leagueId: 2,
    leagueName: "NBA Fantasy 2025",
    sport: "basketball",
    players: [
      { id: 4, name: "LeBron James", position: "Forward", totalPoints: 142, avgPoints: 15.8 },
      { id: 5, name: "Stephen Curry", position: "Guard", totalPoints: 128, avgPoints: 14.2 },
    ],
  },
  {
    leagueId: 3,
    leagueName: "Cricket World Cup",
    sport: "cricket",
    players: [
      { id: 6, name: "Virat Kohli", position: "Batsman", totalPoints: 94, avgPoints: 10.4 },
      { id: 7, name: "Jasprit Bumrah", position: "Bowler", totalPoints: 67, avgPoints: 7.4 },
    ],
  },
];

export function MyTeam() {
  const { user } = useAuth();

  const teams = mockTeams;

  const totals = useMemo(() => {
    const allPlayers = teams.flatMap((team) => team.players);
    const totalPlayers = allPlayers.length;
    const totalPoints = allPlayers.reduce((sum, player) => sum + player.totalPoints, 0);
    const avgPointsPerGame =
      totalPlayers > 0
        ? allPlayers.reduce((sum, player) => sum + player.avgPoints, 0) / totalPlayers
        : 0;

    return {
      totalPlayers,
      totalPoints,
      avgPointsPerGame,
    };
  }, [teams]);

  const hasPlayers = totals.totalPlayers > 0;

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-text-primary">
      <div className="mb-6">
        <p className="text-sm text-text-secondary">Manager: {user?.name ?? "Sporty User"}</p>
      </div>

      <TeamHeader
        totalPlayers={totals.totalPlayers}
        totalPoints={totals.totalPoints}
        avgPointsPerGame={totals.avgPointsPerGame}
      />

      {hasPlayers ? (
        <div className="mt-8 space-y-8">
          {teams.map((team) => (
            <LeagueGroup
              key={team.leagueId}
              leagueName={team.leagueName}
              players={team.players}
              sport={team.sport}
            />
          ))}
        </div>
      ) : (
        <div className="mt-8">
          <EmptyState />
        </div>
      )}
    </section>
  );
}

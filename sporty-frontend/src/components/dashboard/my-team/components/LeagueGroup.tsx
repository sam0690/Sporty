"use client";

import { PlayerCard, type Sport } from "@/components/dashboard/my-team/components/PlayerCard";

type LeaguePlayer = {
  id: number;
  name: string;
  position: string;
  totalPoints: number;
  avgPoints: number;
  teamName?: string;
};

type LeagueGroupProps = {
  leagueName: string;
  players: LeaguePlayer[];
  sport: Sport;
};

const sportBadgeStyles: Record<Sport, string> = {
  football: "bg-accent-football/10 text-accent-football",
  basketball: "bg-accent-basketball/10 text-accent-basketball",
  cricket: "bg-accent-cricket/10 text-accent-cricket",
};

export function LeagueGroup({ leagueName, players, sport }: LeagueGroupProps) {
  return (
    <section>
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-text-primary">{leagueName}</h2>
          <span className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${sportBadgeStyles[sport]}`}>
            {sport}
          </span>
        </div>
        <span className="text-sm text-text-secondary">{players.length} players</span>
      </header>

      <div className="grid grid-cols-1 gap-3">
        {players.map((player) => (
          <PlayerCard
            key={player.id}
            name={player.name}
            sport={sport}
            position={player.position}
            totalPoints={player.totalPoints}
            avgPoints={player.avgPoints}
            teamName={player.teamName}
          />
        ))}
      </div>
    </section>
  );
}

export type { LeaguePlayer, LeagueGroupProps };

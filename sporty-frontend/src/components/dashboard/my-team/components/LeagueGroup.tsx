"use client";

import Image from "next/image";
import {
  PlayerCard,
  type Sport,
} from "@/components/dashboard/my-team/components/PlayerCard";

type LeaguePlayer = {
  id: string;
  name: string;
  sport: Sport;
  position: string;
  realTeam: string;
  cost: string;
  totalPoints: number;
  avgPoints: number;
  teamName?: string;
};

type LeagueGroupProps = {
  leagueName: string;
  players: LeaguePlayer[];
  sports: Sport[];
};

const sportIcons: Record<Sport, string> = {
  football: "⚽",
  basketball: "🏀",
  cricket: "🏏",
};

const sportImages: Record<Sport, string> = {
  football: "/images/leagues/football-card.svg",
  basketball: "/images/leagues/basketball-card.svg",
  cricket: "/images/leagues/cricket-card.svg",
};

export function LeagueGroup({ leagueName, players, sports }: LeagueGroupProps) {
  const primarySport = sports[0] ?? "football";
  const sportCounts = sports.map((sport) => ({
    sport,
    count: players.filter((player) => player.sport === sport).length,
  }));

  return (
    <section className="space-y-5">
      <div className="relative h-24 overflow-hidden rounded-[1.5rem] border border-white/10 bg-linear-to-r from-slate-900 via-slate-800 to-slate-900">
        <Image
          src={sportImages[primarySport]}
          alt=""
          fill
          className="object-cover opacity-18 mix-blend-screen"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-linear-to-r from-slate-950 via-slate-950/80 to-transparent" />

        <header className="relative z-10 flex h-full items-center justify-between gap-3 px-4 sm:px-5">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-foreground">
              {leagueName}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {sportCounts.map(({ sport, count }) => (
                <span
                  key={sport}
                  className="rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-[11px] font-medium text-slate-300"
                >
                  {sportIcons[sport]} {count}
                </span>
              ))}
            </div>
          </div>

          <span className="rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-xs font-medium text-slate-300">
            {players.length} players
          </span>
        </header>
      </div>

      <div className="mb-5 mt-1 border-b border-white/10" />

      <div className="space-y-3">
        {players.map((player) => (
          <PlayerCard
            key={player.id}
            name={player.name}
            sport={player.sport}
            position={player.position}
            realTeam={player.realTeam}
            cost={player.cost}
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

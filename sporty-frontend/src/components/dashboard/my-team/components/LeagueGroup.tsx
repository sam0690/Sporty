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
      <div className="relative h-24 overflow-hidden rounded-2xl border border-gray-100 bg-linear-to-r from-slate-50 via-white to-slate-50">
        <Image
          src={sportImages[primarySport]}
          alt=""
          fill
          className="object-cover opacity-20"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-linear-to-r from-white via-white/80 to-transparent" />

        <header className="relative z-10 flex h-full items-center justify-between gap-3 px-4 sm:px-5">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-gray-900">
              {leagueName}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {sportCounts.map(({ sport, count }) => (
                <span
                  key={sport}
                  className="rounded-full border border-gray-200 bg-white/90 px-2 py-0.5 text-[11px] font-medium text-gray-600"
                >
                  {sportIcons[sport]} {count}
                </span>
              ))}
            </div>
          </div>

          <span className="rounded-full border border-gray-200 bg-white/90 px-2.5 py-1 text-xs font-medium text-gray-600">
            {players.length} players
          </span>
        </header>
      </div>

      <div className="mb-5 mt-1 border-b border-gray-100" />

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

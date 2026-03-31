"use client";

import Image from "next/image";
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

export function LeagueGroup({ leagueName, players, sport }: LeagueGroupProps) {
  return (
    <section className="space-y-5">
      <div className="relative h-16 overflow-hidden rounded-xl border border-gray-100 bg-white">
        <Image
          src={sportImages[sport]}
          alt=""
          fill
          className="object-cover opacity-20"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-transparent" />

        <header className="relative z-10 flex h-full items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2">
            <span className="text-base" aria-hidden="true">{sportIcons[sport]}</span>
            <h2 className="text-lg font-medium text-gray-800">{leagueName}</h2>
          </div>
          <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-500">
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

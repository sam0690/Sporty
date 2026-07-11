"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

type Sport = "football" | "basketball" | "cricket" | "multisport";

type LeagueCardProps = {
  id: string;
  name: string;
  sport: Sport;
  memberCount: number;
  yourRank: number;
  teamName: string;
  points: number;
  animationDelay?: number;
};

const sportImages: Record<Sport, string> = {
  football: "/images/leagues/football-card.svg",
  basketball: "/images/leagues/basketball-card.svg",
  cricket: "/images/leagues/cricket-card.svg",
  multisport: "/images/leagues/multisport-card.svg",
};

const sportBadgeClass: Record<Sport, string> = {
  football: "sport-badge-football",
  basketball: "sport-badge-basketball",
  cricket: "sport-badge-cricket",
  multisport: "sport-badge-multisport",
};

const sportAccentColor: Record<Sport, string> = {
  football: "#4caf50",
  basketball: "#ff6b00",
  cricket: "#00d4ff",
  multisport: "#e8fb25",
};

export function LeagueCard({
  id,
  name,
  sport,
  memberCount,
  yourRank,
  teamName,
  points,
  animationDelay = 0,
}: LeagueCardProps) {
  return (
    <Link
      href={`/leagues/${id}`}
      className="group block overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] opacity-0 transition-colors duration-150 hover:border-[rgba(255,255,255,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(232,251,37,0.4)] animate-fade-soft"
      style={{
        animationDelay: `${animationDelay}ms`,
        borderLeft: `3px solid ${sportAccentColor[sport]}`,
      }}
    >
      <div className="relative h-28 overflow-hidden">
        <Image
          src={sportImages[sport]}
          alt=""
          fill
          className="object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        <div className="absolute inset-0 bg-black/40" />
        <span
          className={`absolute right-3 top-3 rounded-[3px] px-2 py-1 font-barlow-condensed text-xs font-700 uppercase tracking-[1px] ${sportBadgeClass[sport]}`}
        >
          {sport}
        </span>
      </div>

      <div className="space-y-3 p-4">
        <h3 className="truncate font-barlow-condensed text-base font-700 uppercase tracking-[1px] text-[#f0f0f0]">
          {name}
        </h3>

        <div className="space-y-1 text-sm text-[#555560]">
          <p className="truncate">{teamName}</p>
          <p>{memberCount} members</p>
        </div>

        <div className="flex items-center justify-between border-t border-[rgba(255,255,255,0.08)] pt-3">
          <div className="flex items-baseline gap-4">
            <span className="flex items-baseline gap-1.5">
              <span className="font-bebas text-2xl text-[#e8fb25]">
                {yourRank > 0 ? `#${yourRank}` : "—"}
              </span>
              <span className="section-label">Rank</span>
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="font-bebas text-2xl text-[#f0f0f0]">
                {points}
              </span>
              <span className="section-label">Pts</span>
            </span>
          </div>
          <span className="section-label flex items-center gap-1 text-[#555560] transition-colors group-hover:text-[#f0f0f0]">
            View <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export type { LeagueCardProps, Sport };

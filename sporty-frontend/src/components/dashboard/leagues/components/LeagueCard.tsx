"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

type Sport = "football" | "basketball" | "cricket" | "multisport";

type LeagueCardProps = {
  id: string;
  name: string;
  sport: Sport;
  memberCount: number;
  yourRank: number;
  teamName: string;
  animationDelay?: number;
};

const sportIcons: Record<Sport, string> = {
  football: "⚽",
  basketball: "🏀",
  cricket: "🏏",
  multisport: "⚽🏀🏏",
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
  animationDelay = 0,
}: LeagueCardProps) {
  const router = useRouter();

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/leagues/${id}`)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          router.push(`/leagues/${id}`);
        }
      }}
      className="group cursor-pointer overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] opacity-0 transition-colors duration-150 hover:border-[rgba(255,255,255,0.15)] animate-fade-soft"
      style={{
        animationDelay: `${animationDelay}ms`,
        borderLeft: `3px solid ${sportAccentColor[sport]}`,
      }}
    >
      <div className="relative h-28 overflow-hidden">
        <Image
          src={sportImages[sport]}
          alt={`${sport} league`}
          fill
          className="object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        <div className="absolute inset-0 bg-black/40" />
        <span
          className={`absolute right-3 top-3 rounded-[3px] px-2 py-1 font-barlow-condensed text-xs font-700 uppercase tracking-[1px] ${sportBadgeClass[sport]}`}
          aria-label={sport}
        >
          {sport}
        </span>
      </div>

      <div className="space-y-3 p-4">
        <h3 className="font-barlow-condensed text-base font-700 uppercase tracking-[1px] text-[#f0f0f0]">
          {name}
        </h3>

        <div className="space-y-1 text-sm text-[#555560]">
          <p>{teamName}</p>
          <p>{memberCount} members</p>
        </div>

        <div className="flex items-center justify-between border-t border-[rgba(255,255,255,0.08)] pt-3">
          <div className="flex items-center gap-2">
            <span className="font-bebas text-2xl text-[#e8fb25]">
              #{yourRank}
            </span>
            <span className="section-label">Rank</span>
          </div>
          <span className="section-label text-[#555560] transition-colors group-hover:text-[#f0f0f0]">
            View →
          </span>
        </div>
      </div>
    </article>
  );
}

export type { LeagueCardProps, Sport };

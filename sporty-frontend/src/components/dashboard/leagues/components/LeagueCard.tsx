"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

type Sport = "football" | "basketball" | "cricket" | "multisport";

type LeagueCardProps = {
  id: string; // Changed from number to string
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

function rankIcon(rank: number): string {
  if (rank === 1) {
    return "🥇";
  }

  if (rank === 2) {
    return "🥈";
  }

  if (rank === 3) {
    return "🥉";
  }

  return "📊";
}

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
      className="group cursor-pointer overflow-hidden rounded-2xl border border-gray-100 bg-white opacity-0 transition-all duration-200 hover:shadow-md animate-fade-soft"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      <div className="relative h-32 overflow-hidden">
        <Image
          src={sportImages[sport]}
          alt={`${sport} league`}
          fill
          className="object-cover transition-transform duration-200 group-hover:scale-[1.03]"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-transparent" />
      </div>

      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-md font-medium text-gray-900">{name}</h3>
          <span
            className="inline-flex items-center rounded-full border border-gray-200 px-2 py-1 text-xs"
            aria-label={sport}
          >
            {sportIcons[sport]}
          </span>
        </div>

        <div className="space-y-2 text-sm text-gray-500">
          <p>👤 {teamName}</p>
          <p>👥 {memberCount} members</p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>{rankIcon(yourRank)}</span>
            <span>Rank #{yourRank}</span>
          </div>
          <span className="text-sm text-gray-400 transition-colors group-hover:text-primary-500">
            View
          </span>
        </div>
      </div>
    </article>
  );
}

export type { LeagueCardProps, Sport };

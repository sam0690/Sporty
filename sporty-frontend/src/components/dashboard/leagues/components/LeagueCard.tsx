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
      className="group cursor-pointer overflow-hidden rounded-[1.75rem] border border-white/10 bg-surface/80 opacity-0 transition-all duration-300 hover:-translate-y-1 hover:border-accent-primary/30 hover:shadow-[0_24px_60px_rgba(0,229,255,0.12)] animate-fade-soft"
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
        <div className="absolute inset-0 bg-linear-to-b from-black/50 via-black/10 to-transparent" />
      </div>

      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-md font-semibold tracking-tight text-foreground">
            {name}
          </h3>
          <span
            className="inline-flex items-center rounded-full border border-white/10 bg-white/6 px-2 py-1 text-xs text-slate-200"
            aria-label={sport}
          >
            {sportIcons[sport]}
          </span>
        </div>

        <div className="space-y-2 text-sm text-slate-400">
          <p>👤 {teamName}</p>
          <p>👥 {memberCount} members</p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <span className="text-accent-primary">{rankIcon(yourRank)}</span>
            <span>Rank #{yourRank}</span>
          </div>
          <span className="text-sm text-accent-primary/70 transition-colors group-hover:text-accent-primary">
            View
          </span>
        </div>
      </div>
    </article>
  );
}

export type { LeagueCardProps, Sport };

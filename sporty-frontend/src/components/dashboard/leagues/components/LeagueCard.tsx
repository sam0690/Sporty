"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

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
  football: "#16A34A",
  basketball: "#EA580C",
  cricket: "#0891B2",
  multisport: "#DC2626",
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
      className="block group cursor-pointer overflow-hidden opacity-0 animate-fade-soft"
      style={{
        animationDelay: `${animationDelay}ms`,
        borderTop: `3px solid ${sportAccentColor[sport]}`,
      }}
    >
      <div className="relative h-28 overflow-hidden">
        <Image
          src={sportImages[sport]}
          alt={`${sport} league`}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/50 to-transparent" />
        <span
          className={`pill absolute right-3 top-3 ${sportBadgeClass[sport]}`}
          aria-label={sport}
        >
          {sport}
        </span>
      </div>

      <div className="space-y-3 p-5">
        <h3 className="font-condensed text-lg font-bold uppercase tracking-[0.02em] text-ink">
          {name}
        </h3>

        <div className="space-y-0.5 text-sm text-ink-muted">
          <p>{teamName}</p>
          <p>{memberCount} members</p>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <div className="flex items-baseline gap-2">
            <span className="stat-num num text-2xl text-primary">#{yourRank}</span>
            <span className="section-label">Rank</span>
          </div>
          <span className="inline-flex items-center gap-1 font-condensed text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted transition-colors group-hover:text-primary">
            View
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </article>
  );
}

export type { LeagueCardProps, Sport };

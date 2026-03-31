"use client";

import { useRouter } from "next/navigation";

type Sport = "football" | "basketball" | "cricket" | "multisport";

type LeagueCardProps = {
  id: number;
  name: string;
  sport: Sport;
  memberCount: number;
  yourRank: number;
  teamName: string;
};

const sportBadgeStyles: Record<Sport, string> = {
  football: "bg-accent-football/10 text-accent-football",
  basketball: "bg-accent-basketball/10 text-accent-basketball",
  cricket: "bg-accent-cricket/10 text-accent-cricket",
  multisport: "bg-gradient-to-r from-accent-football/15 via-accent-basketball/15 to-accent-cricket/15 text-primary-700",
};

function rankStyle(rank: number): string {
  if (rank === 1) {
    return "text-[#C3B299] font-bold";
  }

  if (rank === 2) {
    return "text-[#CBD4C2] font-bold";
  }

  if (rank === 3) {
    return "text-[#50514F] font-bold";
  }

  return "text-text-secondary";
}

export function LeagueCard({
  id,
  name,
  sport,
  memberCount,
  yourRank,
  teamName,
}: LeagueCardProps) {
  const router = useRouter();

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => router.push(`/league/${id}`)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          router.push(`/league/${id}`);
        }
      }}
      className="cursor-pointer rounded-lg border border-border bg-surface-100 p-5 shadow-card transition-all duration-200 hover:border-primary-200 hover:shadow-card-hover"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-text-primary">{name}</h3>
        <span className={`rounded-full px-2 py-1 text-xs font-medium capitalize ${sportBadgeStyles[sport]}`}>
          {sport}
        </span>
      </div>

      <div className="mt-3 space-y-2 text-sm">
        <p className="text-text-secondary">👥 Team: {teamName}</p>
        <p className="text-text-secondary">Members: {memberCount}</p>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-text-secondary">🏆 Your Rank</span>
        <span className={`text-xl ${rankStyle(yourRank)}`}>#{yourRank}</span>
      </div>
    </article>
  );
}

export type { LeagueCardProps, Sport };

"use client";

type Sport = "football" | "basketball" | "cricket";

type PlayerCardProps = {
  name: string;
  sport: Sport;
  position: string;
  totalPoints: number;
  avgPoints: number;
  teamName?: string;
};

const sportBadgeStyles: Record<Sport, string> = {
  football: "bg-accent-football/10 text-accent-football",
  basketball: "bg-accent-basketball/10 text-accent-basketball",
  cricket: "bg-accent-cricket/10 text-accent-cricket",
};

export function PlayerCard({
  name,
  sport,
  position,
  totalPoints,
  avgPoints,
  teamName,
}: PlayerCardProps) {
  return (
    <article className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-100 p-4 transition-all duration-200 hover:border-primary-200 hover:shadow-card-hover">
      <div className="min-w-0 space-y-1">
        <p className="truncate text-base font-semibold text-text-primary">{name}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full px-2 py-1 font-medium capitalize ${sportBadgeStyles[sport]}`}>
            {sport}
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-1 text-text-secondary">
            {position}
          </span>
        </div>
        {teamName ? <p className="text-xs text-text-secondary">{teamName}</p> : null}
      </div>

      <div className="text-right">
        <p className="text-xl font-bold text-text-primary">{totalPoints}</p>
        <p className="text-xs text-text-secondary">Avg {avgPoints.toFixed(1)} pts</p>
      </div>
    </article>
  );
}

export type { PlayerCardProps, Sport };

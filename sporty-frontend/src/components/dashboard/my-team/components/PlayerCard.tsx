"use client";

type Sport = "football" | "basketball" | "cricket";

type PlayerCardProps = {
  name: string;
  sport: Sport;
  position: string;
  realTeam?: string;
  cost?: string;
  totalPoints: number;
  avgPoints: number;
  teamName?: string;
};

const sportIcons: Record<Sport, string> = {
  football: "⚽",
  basketball: "🏀",
  cricket: "🏏",
};

export function PlayerCard({
  name,
  sport,
  position,
  realTeam,
  cost,
  totalPoints,
  avgPoints,
}: PlayerCardProps) {
  const sportLabel =
    sport === "football"
      ? "Football"
      : sport === "basketball"
        ? "Basketball"
        : "Cricket";

  return (
    <article className="card-fade-in flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent/20 bg-white px-5 py-4 transition-all duration-200 hover:border-border hover:shadow-sm">
      <div className="min-w-0">
        <p className="truncate text-base font-semibold text-black">{name}</p>
        <p className="mt-1 inline-flex items-center gap-1 text-sm text-secondary">
          <span aria-hidden="true" className="text-sm">
            {sportIcons[sport]}
          </span>
          <span className="rounded bg-accent/20 px-1.5 py-0.5 text-xs font-medium text-secondary">
            {position}
          </span>
          <span className="text-xs text-secondary/60">{sportLabel}</span>
        </p>
        {realTeam ? (
          <p className="mt-1 truncate text-xs text-secondary/60">{realTeam}</p>
        ) : null}
      </div>

      <div className="text-right">
        <p className="text-lg font-semibold text-black">{totalPoints} pts</p>
        <p className="text-xs text-secondary/60">({avgPoints.toFixed(1)} avg)</p>
        {cost ? <p className="mt-1 text-xs text-secondary">${cost}M</p> : null}
      </div>
    </article>
  );
}

export type { PlayerCardProps, Sport };

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
    <article className="card-fade-in flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white px-5 py-4 transition-all duration-200 hover:border-gray-200 hover:shadow-sm">
      <div className="min-w-0">
        <p className="truncate text-base font-semibold text-gray-900">{name}</p>
        <p className="mt-1 inline-flex items-center gap-1 text-sm text-gray-500">
          <span aria-hidden="true" className="text-sm">
            {sportIcons[sport]}
          </span>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-600">
            {position}
          </span>
          <span className="text-xs text-gray-400">{sportLabel}</span>
        </p>
        {realTeam ? (
          <p className="mt-1 truncate text-xs text-gray-400">{realTeam}</p>
        ) : null}
      </div>

      <div className="text-right">
        <p className="text-lg font-semibold text-gray-900">{totalPoints} pts</p>
        <p className="text-xs text-gray-400">({avgPoints.toFixed(1)} avg)</p>
        {cost ? <p className="mt-1 text-xs text-gray-500">${cost}M</p> : null}
      </div>
    </article>
  );
}

export type { PlayerCardProps, Sport };

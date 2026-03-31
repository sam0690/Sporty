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

const sportIcons: Record<Sport, string> = {
  football: "⚽",
  basketball: "🏀",
  cricket: "🏏",
};

export function PlayerCard({
  name,
  sport,
  position,
  totalPoints,
  avgPoints,
}: PlayerCardProps) {
  return (
    <article className="card-fade-in flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white px-5 py-4 transition-all duration-200 hover:border-gray-200 hover:shadow-sm">
      <div className="min-w-0 space-y-1">
        <p className="truncate text-base font-medium text-gray-900">👤 {name}</p>
        <p className="inline-flex items-center gap-1 text-sm text-gray-500">
          <span aria-hidden="true" className="text-sm">{sportIcons[sport]}</span>
          <span>{position}</span>
        </p>
      </div>

      <div className="text-right">
        <p className="text-lg font-semibold text-gray-900">{totalPoints} pts</p>
        <p className="text-xs text-gray-400">({avgPoints.toFixed(1)} avg)</p>
      </div>
    </article>
  );
}

export type { PlayerCardProps, Sport };

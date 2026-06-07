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
    <article className="card-fade-in flex flex-wrap items-center justify-between gap-3 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-5 py-4 transition-all duration-200 hover:border-[rgba(232,251,37,0.3)] hover:bg-[#1d1d26]">
      <div className="min-w-0">
        <p className="truncate text-base font-600 text-[#f0f0f0]">
          {name}
        </p>
        <p className="mt-1 inline-flex items-center gap-1 text-sm text-[#555560]">
          <span aria-hidden="true" className="text-sm">
            {sportIcons[sport]}
          </span>
          <span className="rounded bg-[rgba(232,251,37,0.1)] px-1.5 py-0.5 text-xs text-[#e8fb25]">
            {position}
          </span>
          <span className="text-xs text-[#f0f0f0]/50">{sportLabel}</span>
        </p>
        {realTeam ? (
          <p className="mt-1 truncate text-xs text-[#f0f0f0]/50">{realTeam}</p>
        ) : null}
      </div>

      <div className="text-right">
        <p className="text-lg font-600 text-[#f0f0f0]">
          {totalPoints} pts
        </p>
        <p className="text-xs text-[#f0f0f0]/50">
          ({avgPoints.toFixed(1)} avg)
        </p>
        {cost ? (
          <p className="mt-1 text-xs text-[#555560]">${cost}M</p>
        ) : null}
      </div>
    </article>
  );
}

export type { PlayerCardProps, Sport };

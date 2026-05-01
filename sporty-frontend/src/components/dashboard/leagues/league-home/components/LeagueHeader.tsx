"use client";

type Sport = "football" | "basketball";

type LeagueHeaderProps = {
  leagueName: string;
  sport: Sport;
  currentWeek: number;
  totalWeeks: number;
};

const sportIcons: Record<Sport, string> = {
  football: "⚽",
  basketball: "🏀",
};

export function LeagueHeader({
  leagueName,
  sport,
  currentWeek,
  totalWeeks,
}: LeagueHeaderProps) {
  return (
    <header
      className="relative overflow-hidden rounded-lg border border-accent/20 bg-white px-5 py-4"
      style={{
        backgroundImage: "url('/images/landing/hero-stadium.svg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-white/90" aria-hidden="true" />

      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-black">
            {leagueName}
          </h1>
          <span
            className="text-lg leading-none"
            aria-label={sport}
            title={sport}
          >
            {sportIcons[sport]}
          </span>
        </div>

        <p className="rounded-full border border-accent/20 bg-white px-3 py-1 text-sm text-secondary">
          Week {currentWeek} of {totalWeeks}
        </p>
      </div>
    </header>
  );
}

export type { Sport };

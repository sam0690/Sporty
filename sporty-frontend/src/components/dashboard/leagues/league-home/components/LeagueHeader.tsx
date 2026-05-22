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
    <header className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-surface/80 px-5 py-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,229,255,0.15),transparent_34%),radial-gradient(circle_at_right,rgba(255,61,129,0.10),transparent_32%)]"
        aria-hidden="true"
      />

      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-3xl font-bold tracking-[0.04em] text-foreground uppercase">
            {leagueName}
          </h1>
          <span
            className="text-lg leading-none text-accent-primary"
            aria-label={sport}
            title={sport}
          >
            {sportIcons[sport]}
          </span>
        </div>

        <p className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-sm font-medium text-slate-300">
          Week {currentWeek} of {totalWeeks}
        </p>
      </div>
    </header>
  );
}

export type { Sport };

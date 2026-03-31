"use client";

type Sport = "football" | "basketball" | "cricket";

type LeagueHeaderProps = {
  leagueName: string;
  sport: Sport;
  currentWeek: number;
  totalWeeks: number;
};

const sportBadgeStyles: Record<Sport, string> = {
  football: "bg-accent-football/10 text-accent-football",
  basketball: "bg-accent-basketball/10 text-accent-basketball",
  cricket: "bg-accent-cricket/10 text-accent-cricket",
};

export function LeagueHeader({
  leagueName,
  sport,
  currentWeek,
  totalWeeks,
}: LeagueHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary">
          {leagueName}
        </h1>
        <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${sportBadgeStyles[sport]}`}>
          {sport}
        </span>
      </div>

      <p className="text-sm text-text-secondary">Week {currentWeek} of {totalWeeks}</p>
    </header>
  );
}

export type { Sport };

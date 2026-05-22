"use client";

type Sport = "football" | "basketball" | "cricket" | "multisport";

type RosterHeaderProps = {
  leagueName: string;
  sport: Sport;
  rosterSize: number;
  maxRosterSize: number;
  currentWeek?: number;
  totalWeeks?: number;
};

const sportBadgeStyles: Record<Sport, string> = {
  football: "⚽",
  basketball: "🏀",
  cricket: "🏏",
  multisport: "⚽🏀🏏",
};

export function RosterHeader({
  leagueName,
  sport,
  rosterSize,
  maxRosterSize,
  currentWeek,
  totalWeeks,
}: RosterHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {leagueName}
        </h1>
        <span className="text-lg" aria-label={sport} title={sport}>
          {sportBadgeStyles[sport]}
        </span>
      </div>

      <div className="flex items-center gap-4">
        {currentWeek && totalWeeks && (
          <p className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-sm text-slate-300">
            Week {currentWeek} of {totalWeeks}
          </p>
        )}
        <p className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-sm text-slate-300">
          {rosterSize}/{maxRosterSize} players
        </p>
      </div>
    </header>
  );
}

export type { Sport };

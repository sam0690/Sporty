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
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-black">{leagueName}</h1>
        <span className="text-lg" aria-label={sport} title={sport}>{sportBadgeStyles[sport]}</span>
      </div>

      <div className="flex items-center gap-4">
        {currentWeek && totalWeeks && (
          <p className="rounded-full border border-accent/20 bg-white px-3 py-1 text-sm text-secondary">
            Week {currentWeek} of {totalWeeks}
          </p>
        )}
        <p className="rounded-full border border-accent/20 bg-white px-3 py-1 text-sm text-secondary">
          {rosterSize}/{maxRosterSize} players
        </p>
      </div>
    </header>
  );
}

export type { Sport };

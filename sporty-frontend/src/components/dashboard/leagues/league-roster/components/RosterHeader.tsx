"use client";

type Sport = "football" | "basketball" | "cricket" | "multisport";

type RosterHeaderProps = {
  leagueName: string;
  sport: Sport;
  rosterSize: number;
  maxRosterSize: number;
};

const sportBadgeStyles: Record<Sport, string> = {
  football: "⚽",
  basketball: "🏀",
  cricket: "🏏",
  multisport: "⚽🏀🏏",
};

export function RosterHeader({ leagueName, sport, rosterSize, maxRosterSize }: RosterHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-light tracking-tight text-gray-900">{leagueName}</h1>
        <span className="text-lg" aria-label={sport} title={sport}>{sportBadgeStyles[sport]}</span>
      </div>

      <p className="rounded-full border border-gray-100 bg-white px-3 py-1 text-sm text-gray-500">
        {rosterSize}/{maxRosterSize} players
      </p>
    </header>
  );
}

export type { Sport };

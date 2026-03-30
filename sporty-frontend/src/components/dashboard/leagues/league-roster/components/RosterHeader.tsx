"use client";

type Sport = "football" | "basketball" | "cricket" | "multisport";

type RosterHeaderProps = {
  leagueName: string;
  sport: Sport;
  rosterSize: number;
  maxRosterSize: number;
};

const sportBadgeStyles: Record<Sport, string> = {
  football: "bg-accent-football/10 text-accent-football",
  basketball: "bg-accent-basketball/10 text-accent-basketball",
  cricket: "bg-accent-cricket/10 text-accent-cricket",
  multisport: "bg-gradient-to-r from-accent-football/15 via-accent-basketball/15 to-accent-cricket/15 text-primary-700",
};

export function RosterHeader({ leagueName, sport, rosterSize, maxRosterSize }: RosterHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary">{leagueName}</h1>
        {sport === "multisport" ? (
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${sportBadgeStyles[sport]}`}>
            <span aria-hidden="true">⚽</span>
            <span aria-hidden="true">🏀</span>
            <span aria-hidden="true">🏏</span>
            <span>Multi-Sport</span>
          </span>
        ) : (
          <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${sportBadgeStyles[sport]}`}>
            {sport}
          </span>
        )}
      </div>

      <p className="text-sm font-medium text-text-secondary">Roster: {rosterSize}/{maxRosterSize}</p>
    </header>
  );
}

export type { Sport };

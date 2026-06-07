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
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] p-4 ">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-700 tracking-[2px] text-[#f0f0f0]">
          {leagueName}
        </h1>
        <span className="text-lg" aria-label={sport} title={sport}>
          {sportBadgeStyles[sport]}
        </span>
      </div>

      <div className="flex items-center gap-4">
        {currentWeek && totalWeeks && (
          <p className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-3 py-1 text-sm text-[#f0f0f0]">
            Week {currentWeek} of {totalWeeks}
          </p>
        )}
        <p className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-3 py-1 text-sm text-[#f0f0f0]">
          {rosterSize}/{maxRosterSize} players
        </p>
      </div>
    </header>
  );
}

export type { Sport };

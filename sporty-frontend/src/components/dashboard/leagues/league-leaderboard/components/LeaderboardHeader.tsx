"use client";

type Sport = "football" | "basketball" | "cricket" | "multisport";

type LeaderboardHeaderProps = {
  leagueName: string;
  sport: Sport;
  seasonName?: string;
  currentWeek: number;
  totalWeeks: number;
};

const sportBadgeClass: Record<Sport, string> = {
  football: "sport-badge-football",
  basketball: "sport-badge-basketball",
  cricket: "sport-badge-cricket",
  multisport: "sport-badge-multisport",
};

export function LeaderboardHeader({
  leagueName,
  sport,
  seasonName,
}: LeaderboardHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[rgba(255,255,255,0.08)] pb-5">
      <div className="flex items-center gap-3">
        <h1 className="font-bebas text-5xl tracking-[3px] text-[#f0f0f0]">
          {leagueName}
        </h1>
        <span
          className={`rounded-[3px] px-2 py-1 font-barlow-condensed text-xs font-700 uppercase tracking-[1px] ${sportBadgeClass[sport]}`}
          aria-label={sport}
          title={sport}
        >
          {sport}
        </span>
      </div>

      <span className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] px-3 py-1 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] text-[#555560]">
        Season {seasonName || "Unknown"}
      </span>
    </header>
  );
}

export type { Sport };

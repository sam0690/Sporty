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
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[rgba(11,18,32,0.08)] pb-5">
      <div className="flex items-center gap-3">
        <h1 className="font-bebas text-5xl tracking-[3px] text-[#0B1220]">
          {leagueName}
        </h1>
        <span
          className={`rounded-[3px] px-2 py-1 font-barlow-condensed text-xs font-bold uppercase tracking-[1px] ${sportBadgeClass[sport]}`}
          aria-label={sport}
          title={sport}
        >
          {sport}
        </span>
      </div>

      <span className="rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] px-3 py-1 font-barlow-condensed text-xs font-bold uppercase tracking-[2px] text-[#6B7280]">
        Season {seasonName || "Unknown"}
      </span>
    </header>
  );
}

export type { Sport };

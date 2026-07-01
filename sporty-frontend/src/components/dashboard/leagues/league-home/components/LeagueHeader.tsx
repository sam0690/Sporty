"use client";

type Sport = "football" | "basketball";

type LeagueHeaderProps = {
  leagueName: string;
  sport: Sport;
  currentWeek: number;
  totalWeeks: number;
};

const sportBadgeClass: Record<Sport, string> = {
  football: "sport-badge-football",
  basketball: "sport-badge-basketball",
};

export function LeagueHeader({
  leagueName,
  sport,
  currentWeek,
  totalWeeks,
}: LeagueHeaderProps) {
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

      <div className="flex items-center gap-2 rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] px-4 py-2">
        <span className="font-bebas text-2xl text-[#DC2626]">{currentWeek}</span>
        <span className="section-label">/ {totalWeeks} weeks</span>
      </div>
    </header>
  );
}

export type { Sport };

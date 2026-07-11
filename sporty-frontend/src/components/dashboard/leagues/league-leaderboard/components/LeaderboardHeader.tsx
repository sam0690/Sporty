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

const sportGlow: Record<Sport, string> = {
  football: "#00ff88",
  basketball: "#ff6b00",
  cricket: "#00d4ff",
  multisport: "#e8fb25",
};

export function LeaderboardHeader({
  leagueName,
  sport,
  seasonName,
  currentWeek,
  totalWeeks,
}: LeaderboardHeaderProps) {
  const progressPercent = totalWeeks > 0
    ? Math.min(100, Math.max(0, Math.round((currentWeek / totalWeeks) * 100)))
    : 0;
  const glow = sportGlow[sport];

  return (
    <header
      className="relative overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] p-6 sm:p-8"
      style={{ background: `linear-gradient(135deg, ${glow}14 0%, #0d0d12 60%)` }}
    >
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl"
        style={{ background: `${glow}22` }}
        aria-hidden
      />

      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex rounded-[3px] px-2 py-1 font-barlow-condensed text-[10px] font-700 uppercase tracking-[1.5px] ${sportBadgeClass[sport]}`}
              aria-label={sport}
              title={sport}
            >
              {sport}
            </span>
            <span className="font-barlow-condensed text-[10px] font-700 uppercase tracking-[2px] text-[#555560]">
              Season {seasonName || "Unknown"}
            </span>
          </div>
          <h1 className="mt-3 truncate font-bebas text-5xl tracking-[3px] text-[#f0f0f0] sm:text-7xl">
            {leagueName}
          </h1>
        </div>

        <div className="min-w-[220px] shrink-0">
          <div className="flex items-center justify-between gap-3">
            <span className="section-label">Season Progress</span>
            <span className="font-bebas text-xl tracking-[1px] text-[#e8fb25]">
              GW {currentWeek}
              <span className="text-[#555560]">/{totalWeeks}</span>
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
            <div
              className="h-full rounded-full bg-[#e8fb25] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}

export type { Sport };

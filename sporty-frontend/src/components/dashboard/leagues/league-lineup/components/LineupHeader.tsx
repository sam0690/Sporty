"use client";

type Sport = "football" | "basketball" | "cricket" | "multisport";

type LineupHeaderProps = {
  leagueName: string;
  teamName?: string;
  sport: Sport;
  currentWeek: number;
  totalWeeks: number;
  deadline: string;
};

const sportBadgeClass: Record<Sport, string> = {
  football: "sport-badge-football",
  basketball: "sport-badge-basketball",
  cricket: "sport-badge-cricket",
  multisport: "sport-badge-multisport",
};

function formatCountdown(deadline: string): { label: string; locked: boolean } {
  const deadlineMs = new Date(deadline).getTime();
  const nowMs = Date.now();
  const diff = deadlineMs - nowMs;

  if (Number.isNaN(deadlineMs) || diff <= 0) {
    return { label: "Lineup locked", locked: true };
  }

  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  return { label: `Lock in: ${days}d ${hours}h ${minutes}m`, locked: false };
}

export function LineupHeader({
  leagueName,
  teamName,
  sport,
  currentWeek,
  totalWeeks,
  deadline,
}: LineupHeaderProps) {
  const countdown = formatCountdown(deadline);

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[rgba(255,255,255,0.08)] pb-5">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="font-bebas text-5xl tracking-[3px] text-[#f0f0f0]">
            {leagueName}
          </h1>
          {teamName ? (
            <p className="section-label mt-1">Team: {teamName}</p>
          ) : null}
        </div>
        <span
          className={`rounded-[3px] px-2 py-1 font-barlow-condensed text-xs font-700 uppercase tracking-[1px] ${sportBadgeClass[sport]}`}
          aria-label={sport}
        >
          {sport}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] px-3 py-1.5">
          <span className="font-bebas text-xl tracking-[2px] text-[#e8fb25]">{currentWeek}</span>
          <span className="section-label">/ {totalWeeks}</span>
        </div>
        <span
          className={`rounded-[3px] border px-4 py-1.5 font-barlow-condensed text-xs font-700 uppercase tracking-[2px] ${
            countdown.locked
              ? "border-[rgba(255,59,48,0.3)] bg-[#2a1010] text-[#ff3b30]"
              : "alert-deadline"
          }`}
        >
          {countdown.locked ? "Lineup Locked" : countdown.label}
        </span>
      </div>
    </header>
  );
}

"use client";

type Sport = "football" | "basketball" | "cricket" | "multisport";

type LineupHeaderProps = {
  leagueName: string;
  sport: Sport;
  currentWeek: number;
  deadline: string;
};

const sportBadgeStyles: Record<Sport, string> = {
  football: "bg-accent-football/10 text-accent-football",
  basketball: "bg-accent-basketball/10 text-accent-basketball",
  cricket: "bg-accent-cricket/10 text-accent-cricket",
  multisport: "bg-gradient-to-r from-accent-football/15 via-accent-basketball/15 to-accent-cricket/15 text-primary-700",
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

  return {
    label: `Lock in: ${days}d ${hours}h ${minutes}m`,
    locked: false,
  };
}

export function LineupHeader({
  leagueName,
  sport,
  currentWeek,
  deadline,
}: LineupHeaderProps) {
  const countdown = formatCountdown(deadline);
  const isMultiSport = sport === "multisport";

  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary">
          {leagueName}
        </h1>
        {isMultiSport ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-accent-football/15 via-accent-basketball/15 to-accent-cricket/15 px-3 py-1 text-xs font-medium text-primary-700">
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

      <div className="text-right">
        <p className="text-sm text-text-secondary">Week {currentWeek} Lineup</p>
        <p className={`text-sm font-medium ${countdown.locked ? "text-amber-600" : "text-primary-600"}`}>
          {countdown.label}
        </p>
      </div>
    </header>
  );
}

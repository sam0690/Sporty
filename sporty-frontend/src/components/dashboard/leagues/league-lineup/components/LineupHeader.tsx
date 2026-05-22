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

const sportIcons: Record<Sport, string> = {
  football: "⚽",
  basketball: "🏀",
  cricket: "🏏",
  multisport: "⚽🏀🏏",
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
  teamName,
  sport,
  currentWeek,
  totalWeeks,
  deadline,
}: LineupHeaderProps) {
  const countdown = formatCountdown(deadline);

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {leagueName}
          </h1>
          {teamName ? (
            <p className="text-sm text-foreground/60">Team: {teamName}</p>
          ) : null}
        </div>
        <span className="text-lg" aria-label={sport} title={sport}>
          {sportIcons[sport]}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <p className="text-sm text-foreground/60">
          Week {currentWeek} of {totalWeeks}
        </p>
        <p
          className={`rounded-full border px-4 py-1.5 text-sm ${
            countdown.locked
              ? "border-red-400/20 bg-red-500/10 text-red-100"
              : "border-white/10 bg-white/5 text-foreground/75"
          }`}
        >
          {countdown.locked ? "Lineup Locked" : countdown.label}
        </p>
      </div>
    </header>
  );
}

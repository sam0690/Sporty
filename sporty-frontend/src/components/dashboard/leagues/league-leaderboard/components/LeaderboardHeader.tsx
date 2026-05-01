"use client";

type Sport = "football" | "basketball" | "cricket" | "multisport";

type LeaderboardHeaderProps = {
  leagueName: string;
  sport: Sport;
  currentWeek: number;
  totalWeeks: number;
};

const sportIcons: Record<Sport, string> = {
  football: "⚽",
  basketball: "🏀",
  cricket: "🏏",
  multisport: "⚽🏀🏏",
};

export function LeaderboardHeader({ leagueName, sport }: LeaderboardHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-black">{leagueName}</h1>
        <span className="text-lg" aria-label={sport} title={sport}>{sportIcons[sport]}</span>
      </div>

      <p className="rounded-full border border-accent/20 bg-white px-3 py-1 text-sm text-secondary">Season 2025</p>
    </header>
  );
}

export type { Sport };

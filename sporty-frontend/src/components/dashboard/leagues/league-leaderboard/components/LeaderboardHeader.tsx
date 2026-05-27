"use client";

type Sport = "football" | "basketball" | "cricket" | "multisport";

type LeaderboardHeaderProps = {
  leagueName: string;
  sport: Sport;
  seasonName?: string;
  currentWeek: number;
  totalWeeks: number;
};

const sportIcons: Record<Sport, string> = {
  football: "⚽",
  basketball: "🏀",
  cricket: "🏏",
  multisport: "⚽🏀🏏",
};

export function LeaderboardHeader({
  leagueName,
  sport,
  seasonName,
}: LeaderboardHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {leagueName}
        </h1>
        <span className="text-lg" aria-label={sport} title={sport}>
          {sportIcons[sport]}
        </span>
      </div>

      <p className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-foreground/70">
        Season {seasonName || "Unknown"}
      </p>
    </header>
  );
}

export type { Sport };

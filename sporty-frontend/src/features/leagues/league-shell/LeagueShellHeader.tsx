"use client";

import { Badge } from "@/components/ui";

type Sport = "football" | "basketball";

type LeagueShellHeaderProps = {
  leagueName: string;
  sport: Sport;
  currentWeek: number;
  totalWeeks: number;
  isDraftMode: boolean;
};

const sportGlow: Record<Sport, string> = {
  football: "#00ff88",
  basketball: "#ff6b35",
};

export function LeagueShellHeader({
  leagueName,
  sport,
  currentWeek,
  totalWeeks,
  isDraftMode,
}: LeagueShellHeaderProps) {
  const progressPercent =
    totalWeeks > 0
      ? Math.min(100, Math.max(0, Math.round((currentWeek / totalWeeks) * 100)))
      : 0;
  const glow = sportGlow[sport];

  return (
    <header
      className="relative mb-5 overflow-hidden rounded-[3px] border border-white/8 p-6 sm:p-8"
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
            <Badge sport={sport} size="sm">
              {sport}
            </Badge>
            <Badge tone="neutral" size="sm">
              {isDraftMode ? "Draft" : "Budget"}
            </Badge>
          </div>
          <h1 className="mt-3 truncate font-display text-5xl tracking-[-0.02em] text-fg-1 sm:text-7xl">
            {leagueName}
          </h1>
        </div>

        <div className="min-w-[220px] shrink-0">
          <div className="flex items-center justify-between gap-3">
            <span className="section-label">Season Progress</span>
            <span className="font-display text-xl tracking-[-0.02em] text-accent">
              GW {currentWeek}
              <span className="text-fg-3">/{totalWeeks}</span>
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}

export type { Sport };

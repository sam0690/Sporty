"use client";

import type { ComponentType } from "react";
import {
  FootballGlyph,
  BasketballGlyph,
  CricketGlyph,
  BoltGlyph,
} from "@/components/landing/sport-icons";

type Sport = "football" | "basketball" | "cricket" | "multisport";

type RosterHeaderProps = {
  leagueName: string;
  sport: Sport;
  rosterSize: number;
  maxRosterSize: number;
  currentWeek?: number;
  totalWeeks?: number;
};

const sportGlyph: Record<Sport, ComponentType<{ className?: string }>> = {
  football: FootballGlyph,
  basketball: BasketballGlyph,
  cricket: CricketGlyph,
  multisport: BoltGlyph,
};

const sportColor: Record<Sport, string> = {
  football: "#16A34A",
  basketball: "#EA580C",
  cricket: "#0891B2",
  multisport: "#9333EA",
};

export function RosterHeader({
  leagueName,
  sport,
  rosterSize,
  maxRosterSize,
  currentWeek,
  totalWeeks,
}: RosterHeaderProps) {
  const Glyph = sportGlyph[sport];

  return (
    <header className="surface flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="flex items-center gap-3">
        <span
          className="grid h-9 w-9 place-items-center rounded-sm"
          style={{ color: sportColor[sport], background: `${sportColor[sport]}14` }}
          aria-label={sport}
          title={sport}
        >
          <Glyph className="h-5 w-5" />
        </span>
        <h1 className="font-condensed text-2xl font-bold uppercase tracking-[0.02em] text-ink">
          {leagueName}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        {currentWeek && totalWeeks && (
          <p className="rounded-sm border border-border bg-surface-muted px-3 py-1.5 font-condensed text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
            Week {currentWeek} of {totalWeeks}
          </p>
        )}
        <p className="rounded-sm border border-border bg-surface-muted px-3 py-1.5 font-condensed text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
          <span className="num">
            {rosterSize}/{maxRosterSize}
          </span>{" "}
          players
        </p>
      </div>
    </header>
  );
}

export type { Sport };

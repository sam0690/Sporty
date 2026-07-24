"use client";

import { CalendarPopover } from "./CalendarPopover";
import { MatchDateStrip } from "./MatchDateStrip";
import { SportFilterChips } from "./SportFilterChips";

type FixturesToolbarProps = {
  date: string;
  onDateChange: (date: string) => void;
  sport: string;
  onSportChange: (sport: string) => void;
  totalLive: number;
};

// FotMob-style control surface: date strip beside the heading, sport chips
// centered beneath. Sticky under the site navbar so day/sport switching
// follows the scroll.
export function FixturesToolbar({
  date,
  onDateChange,
  sport,
  onSportChange,
  totalLive,
}: FixturesToolbarProps) {
  return (
    <div className="sticky top-16 z-30 -mx-4 border-b border-white/8 bg-surface-0/95 px-4 pb-3 pt-4 backdrop-blur-sm sm:-mx-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl leading-none tracking-[-0.02em] text-fg-1">
            Fixtures
          </h1>
          {totalLive > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-[3px] border border-danger/30 bg-danger/10 px-2 py-0.5 font-sans text-[10px] font-700 uppercase tracking-[1.5px] text-danger">
              <span className="size-1.5 rounded-full bg-danger animate-live-pulse" />
              {totalLive} Live
            </span>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <MatchDateStrip selectedDate={date} onDateChange={onDateChange} />
          <CalendarPopover selectedDate={date} onDateChange={onDateChange} />
        </div>
      </div>
      <div className="mt-3 flex justify-center">
        <SportFilterChips active={sport} onChange={onSportChange} />
      </div>
    </div>
  );
}

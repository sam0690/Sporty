"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type WeekSelectorProps = {
  currentWeek: number;
  totalWeeks: number;
  onWeekChange: (week: number) => void;
};

export function WeekSelector({
  currentWeek,
  totalWeeks,
  onWeekChange,
}: WeekSelectorProps) {
  if (totalWeeks <= 1) return null;

  return (
    <div className="inline-flex items-center gap-1 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117] px-2 py-1">
      <button
        type="button"
        onClick={() => onWeekChange(currentWeek - 1)}
        disabled={currentWeek <= 1}
        className="rounded-[3px] p-1 text-[#555560] transition-colors hover:text-[#f0f0f0] disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Previous week"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <span className="px-2 font-bebas text-xl tracking-[2px] text-[#e8fb25]">
        Week {currentWeek}
      </span>

      <label htmlFor="week-select" className="sr-only">Select week</label>
      <select
        id="week-select"
        value={currentWeek}
        onChange={(event) => onWeekChange(Number(event.target.value))}
        className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-2 py-1 font-barlow-condensed text-xs font-700 uppercase tracking-[1px] text-[#f0f0f0] outline-none transition-colors hover:border-[rgba(232,251,37,0.3)] focus:border-[#e8fb25]"
        aria-label="Select week"
      >
        {Array.from({ length: totalWeeks }, (_, index) => {
          const week = index + 1;
          return (
            <option key={week} value={week}>Week {week}</option>
          );
        })}
      </select>

      <button
        type="button"
        onClick={() => onWeekChange(currentWeek + 1)}
        disabled={currentWeek >= totalWeeks}
        className="rounded-[3px] p-1 text-[#555560] transition-colors hover:text-[#f0f0f0] disabled:cursor-not-allowed disabled:opacity-30"
        aria-label="Next week"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

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
  if (totalWeeks <= 1) {
    return null;
  }

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-gray-100 bg-white px-2 py-1">
      <button
        type="button"
        onClick={() => onWeekChange(currentWeek - 1)}
        disabled={currentWeek <= 1}
        className="rounded-full p-1 text-gray-400 transition-colors hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Previous week"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <p className="px-1 text-sm font-medium text-gray-700">Week {currentWeek}</p>
      <label htmlFor="week-select" className="sr-only">Select week</label>
      <select
        id="week-select"
        value={currentWeek}
        onChange={(event) => {
          onWeekChange(Number(event.target.value));
        }}
        className="rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 outline-none transition-colors hover:border-gray-300 focus:border-primary-300"
        aria-label="Select week"
      >
        {Array.from({ length: totalWeeks }, (_, index) => {
          const week = index + 1;

          return (
            <option key={week} value={week}>
              Week {week}
            </option>
          );
        })}
      </select>
      <button
        type="button"
        onClick={() => onWeekChange(currentWeek + 1)}
        disabled={currentWeek >= totalWeeks}
        className="rounded-full p-1 text-gray-400 transition-colors hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Next week"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

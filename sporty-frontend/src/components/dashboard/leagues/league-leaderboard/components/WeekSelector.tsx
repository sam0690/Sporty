"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type SelectedWeek = number | "overall";

type WeekSelectorProps = {
  currentWeek: number;
  totalWeeks: number;
  selectedWeek: SelectedWeek;
  onWeekChange: (week: SelectedWeek) => void;
};

export function WeekSelector({ currentWeek, totalWeeks, selectedWeek, onWeekChange }: WeekSelectorProps) {
  const numericSelected = typeof selectedWeek === "number" ? selectedWeek : currentWeek;
  const overallActive = selectedWeek === "overall";

  return (
    <section className="mb-6 flex flex-wrap items-center justify-end gap-2">
      <div className="inline-flex items-center gap-2 rounded-full border border-gray-100 bg-white px-2 py-1">
      <button
        type="button"
        onClick={() => {
          const next = Math.max(1, numericSelected - 1);
          onWeekChange(next);
        }}
        disabled={selectedWeek === "overall" ? false : numericSelected <= 1}
        className="rounded-full p-1 text-gray-400 transition-colors hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Previous week"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <p className="px-1 text-sm font-medium text-gray-700">Week {numericSelected}</p>

      <button
        type="button"
        onClick={() => {
          const next = Math.min(totalWeeks, numericSelected + 1);
          onWeekChange(next);
        }}
        disabled={selectedWeek === "overall" ? false : numericSelected >= totalWeeks}
        className="rounded-full p-1 text-gray-400 transition-colors hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Next week"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      </div>

      <button
        type="button"
        onClick={() => onWeekChange("overall")}
        className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
          overallActive
            ? "border-primary-500 bg-primary-500 text-white"
            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
        }`}
      >
        Overall
      </button>
    </section>
  );
}

export type { SelectedWeek };

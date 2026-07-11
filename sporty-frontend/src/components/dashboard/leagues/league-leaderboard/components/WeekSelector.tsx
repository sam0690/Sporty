"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type SelectedWeek = number | "overall";

type WeekSelectorProps = {
  currentWeek: number;
  totalWeeks: number;
  selectedWeek: SelectedWeek;
  onWeekChange: (week: SelectedWeek) => void;
};

export function WeekSelector({
  currentWeek,
  totalWeeks,
  selectedWeek,
  onWeekChange,
}: WeekSelectorProps) {
  const numericSelected =
    typeof selectedWeek === "number" ? selectedWeek : currentWeek;
  const overallActive = selectedWeek === "overall";

  return (
    <section className="mb-6 flex flex-wrap items-center justify-end gap-2">
      <div className="inline-flex items-center gap-2 rounded-[3px] border border-white/8 bg-surface-3 px-2 py-1 ">
        <button
          type="button"
          onClick={() => {
            const next = Math.max(1, numericSelected - 1);
            onWeekChange(next);
          }}
          disabled={selectedWeek === "overall" ? false : numericSelected <= 1}
          className="rounded-full p-1 text-fg-1/50 transition-colors hover:text-fg-1 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous week"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <p className="px-1 text-sm text-fg-1">
          Week {numericSelected}
        </p>

        <button
          type="button"
          onClick={() => {
            const next = Math.min(totalWeeks, numericSelected + 1);
            onWeekChange(next);
          }}
          disabled={
            selectedWeek === "overall" ? false : numericSelected >= totalWeeks
          }
          className="rounded-full p-1 text-fg-1/50 transition-colors hover:text-fg-1 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next week"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => onWeekChange("overall")}
        className={`rounded-[3px] border px-4 py-1.5 text-sm transition-colors ${
          overallActive
            ? "border-accent/30 bg-accent/10 text-accent"
            : "border-white/8 bg-surface-3 text-fg-3 hover:bg-surface-3"
        }`}
      >
        Overall
      </button>
    </section>
  );
}

export type { SelectedWeek };

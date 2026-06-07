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
      <div className="inline-flex items-center gap-2 rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-2 py-1 ">
        <button
          type="button"
          onClick={() => {
            const next = Math.max(1, numericSelected - 1);
            onWeekChange(next);
          }}
          disabled={selectedWeek === "overall" ? false : numericSelected <= 1}
          className="rounded-full p-1 text-[#f0f0f0]/50 transition-colors hover:text-[#f0f0f0] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous week"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <p className="px-1 text-sm text-[#f0f0f0]">
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
          className="rounded-full p-1 text-[#f0f0f0]/50 transition-colors hover:text-[#f0f0f0] disabled:cursor-not-allowed disabled:opacity-40"
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
            ? "border-[rgba(232,251,37,0.3)] bg-[rgba(232,251,37,0.1)] text-[#e8fb25]"
            : "border-[rgba(255,255,255,0.08)] bg-[#1d1d26] text-[#555560] hover:bg-[#1d1d26]"
        }`}
      >
        Overall
      </button>
    </section>
  );
}

export type { SelectedWeek };

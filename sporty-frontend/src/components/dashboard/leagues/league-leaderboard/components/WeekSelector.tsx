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
      <div className="inline-flex items-center gap-2 rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] px-2 py-1 ">
        <button
          type="button"
          onClick={() => {
            const next = Math.max(1, numericSelected - 1);
            onWeekChange(next);
          }}
          disabled={selectedWeek === "overall" ? false : numericSelected <= 1}
          className="rounded-full p-1 text-[#0B1220]/50 transition-colors hover:text-[#0B1220] disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous week"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <p className="px-1 text-sm text-[#0B1220]">
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
          className="rounded-full p-1 text-[#0B1220]/50 transition-colors hover:text-[#0B1220] disabled:cursor-not-allowed disabled:opacity-40"
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
            ? "border-[rgba(220,38,38,0.3)] bg-[rgba(220,38,38,0.1)] text-[#DC2626]"
            : "border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] text-[#6B7280] hover:bg-[#F3F4F7]"
        }`}
      >
        Overall
      </button>
    </section>
  );
}

export type { SelectedWeek };

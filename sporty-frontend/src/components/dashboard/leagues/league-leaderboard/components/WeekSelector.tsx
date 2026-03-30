"use client";

type SelectedWeek = number | "overall";

type WeekSelectorProps = {
  currentWeek: number;
  totalWeeks: number;
  selectedWeek: SelectedWeek;
  onWeekChange: (week: SelectedWeek) => void;
};

export function WeekSelector({ currentWeek, totalWeeks, selectedWeek, onWeekChange }: WeekSelectorProps) {
  const numericSelected = typeof selectedWeek === "number" ? selectedWeek : currentWeek;

  return (
    <section className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => {
          const next = Math.max(1, numericSelected - 1);
          onWeekChange(next);
        }}
        disabled={selectedWeek === "overall" ? false : numericSelected <= 1}
        className="rounded-lg border border-border px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        ‹
      </button>

      <select
        value={String(selectedWeek)}
        onChange={(event) => {
          const value = event.target.value;
          if (value === "overall") {
            onWeekChange("overall");
            return;
          }

          onWeekChange(Number(value));
        }}
        className="rounded-lg border border-border bg-surface-100 px-3 py-2 text-sm text-text-primary"
      >
        <option value="overall">Overall</option>
        {Array.from({ length: totalWeeks }, (_, index) => index + 1).map((week) => (
          <option key={week} value={week}>Week {week}</option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => {
          const next = Math.min(totalWeeks, numericSelected + 1);
          onWeekChange(next);
        }}
        disabled={selectedWeek === "overall" ? false : numericSelected >= totalWeeks}
        className="rounded-lg border border-border px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        ›
      </button>
    </section>
  );
}

export type { SelectedWeek };

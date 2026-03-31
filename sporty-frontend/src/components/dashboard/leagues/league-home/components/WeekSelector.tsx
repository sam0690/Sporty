"use client";

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
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onWeekChange(currentWeek - 1)}
        disabled={currentWeek <= 1}
        className="rounded-lg border border-border px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        ‹
      </button>
      <p className="text-sm font-medium text-text-primary">Week {currentWeek}</p>
      <button
        type="button"
        onClick={() => onWeekChange(currentWeek + 1)}
        disabled={currentWeek >= totalWeeks}
        className="rounded-lg border border-border px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        ›
      </button>
    </div>
  );
}

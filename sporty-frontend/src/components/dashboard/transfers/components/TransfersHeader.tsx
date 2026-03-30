"use client";

type TransfersHeaderProps = {
  budget: number;
  leagueName: string;
  currentWeek: number;
};

export function TransfersHeader({
  budget,
  leagueName,
  currentWeek,
}: TransfersHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-text-primary">
          Transfers & Market
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          {leagueName} - Week {currentWeek}
        </p>
      </div>

      <div className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 font-semibold text-primary-600">
        <span aria-hidden="true">$</span>
        <span>{budget.toFixed(1)}M</span>
      </div>
    </header>
  );
}

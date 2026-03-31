"use client";

type CreateLeagueHeaderProps = {
  step: number;
  totalSteps: number;
  leagueName: string;
};

const stepLabels = ["Basic Info", "League Settings", "Scoring", "Summary"];

export function CreateLeagueHeader({ step, totalSteps, leagueName }: CreateLeagueHeaderProps) {
  const clampedStep = Math.min(Math.max(step, 1), totalSteps);
  const label = stepLabels[clampedStep - 1] ?? "Step";
  const progress = Math.round((clampedStep / totalSteps) * 100);

  return (
    <div className="sticky top-0 z-10 rounded-b-lg bg-white/80 pb-4 backdrop-blur">
      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-text-secondary">Create League</p>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold text-text-primary">
            {leagueName ? leagueName : "New League"}
          </h1>
          <p className="text-sm text-text-secondary">
            Step {clampedStep} of {totalSteps}: {label}
          </p>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-surface-200">
          <div
            className="h-full rounded-full bg-primary-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

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
    <div className="sticky top-0 z-10 bg-white/80 py-3 backdrop-blur-sm">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold text-black">
            {leagueName ? leagueName : "New League"}
          </h1>
          <p className="text-sm text-secondary">
            Step {clampedStep} of {totalSteps}: {label}
          </p>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-accent/30">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

"use client";

type CreateLeagueHeaderProps = {
  step: number;
  totalSteps: number;
  leagueName: string;
};

const stepLabels = ["Basic Info", "League Settings", "Scoring", "Summary"];

export function CreateLeagueHeader({
  step,
  totalSteps,
  leagueName,
}: CreateLeagueHeaderProps) {
  const clampedStep = Math.min(Math.max(step, 1), totalSteps);
  const label = stepLabels[clampedStep - 1] ?? "Step";
  const progress = Math.round((clampedStep / totalSteps) * 100);

  return (
    <div className="sticky top-0 z-10 rounded-[1.75rem] border border-white/10 bg-background/75 py-4 backdrop-blur-xl">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-xl font-bold tracking-[0.04em] text-foreground uppercase">
            {leagueName ? leagueName : "New League"}
          </h1>
          <p className="text-sm text-slate-400">
            Step {clampedStep} of {totalSteps}: {label}
          </p>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-linear-to-r from-accent-primary via-cyan-400 to-accent-secondary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

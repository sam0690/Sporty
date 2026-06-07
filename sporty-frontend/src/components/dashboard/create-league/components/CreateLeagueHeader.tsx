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
    <div className="sticky top-0 z-10 rounded-[1.75rem] border border-[rgba(255,255,255,0.08)] bg-background/75 py-4 ">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-bebas tracking-[3px] text-[#f0f0f0]">
            {leagueName ? leagueName : "New League"}
          </h1>
          <p className="text-sm text-[#555560]">
            Step {clampedStep} of {totalSteps}: {label}
          </p>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-[3px] bg-[#1d1d26]">
          <div
            className="h-full rounded-[3px] bg-linear-to-r [#e8fb25] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

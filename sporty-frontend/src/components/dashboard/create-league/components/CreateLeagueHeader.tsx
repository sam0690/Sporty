"use client";

import { Fragment } from "react";

type CreateLeagueHeaderProps = {
  step: number;
  totalSteps: number;
  leagueName: string;
};

const stepLabels = ["Basic Info", "Settings", "Scoring", "Summary"];

export function CreateLeagueHeader({
  step,
  totalSteps,
  leagueName,
}: CreateLeagueHeaderProps) {
  const clampedStep = Math.min(Math.max(step, 1), totalSteps);
  const steps = stepLabels.slice(0, totalSteps);

  return (
    <div>
      <p className="section-label">Create League</p>
      <h1 className="mt-2 truncate font-bebas text-4xl tracking-[3px] text-[#f0f0f0] sm:text-5xl">
        {leagueName ? leagueName : "New League"}
      </h1>

      <div className="mt-5 flex items-center">
        {steps.map((label, index) => {
          const n = index + 1;
          const isDone = n < clampedStep;
          const isActive = n === clampedStep;
          return (
            <Fragment key={label}>
              <div className="flex items-center gap-2">
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full border font-bebas text-sm leading-none ${
                    isDone
                      ? "border-[#e8fb25] bg-[#e8fb25] text-[#0a0a0f]"
                      : isActive
                        ? "border-[#e8fb25] bg-[rgba(232,251,37,0.12)] text-[#e8fb25]"
                        : "border-[rgba(255,255,255,0.12)] bg-[#1d1d26] text-[#555560]"
                  }`}
                >
                  {isDone ? "✓" : n}
                </span>
                <span
                  className={`hidden font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] sm:inline ${
                    isActive
                      ? "text-[#e8fb25]"
                      : isDone
                        ? "text-[#f0f0f0]"
                        : "text-[#555560]"
                  }`}
                >
                  {label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <span
                  className={`mx-2 h-px flex-1 ${
                    isDone ? "bg-[rgba(232,251,37,0.4)]" : "bg-[rgba(255,255,255,0.1)]"
                  }`}
                />
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

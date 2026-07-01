"use client";

import { Fragment } from "react";
import { Check } from "lucide-react";

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
      <h1 className="mt-2 truncate font-bebas text-4xl tracking-[3px] text-[#0B1220] sm:text-5xl">
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
                      ? "border-[#DC2626] bg-[#DC2626] text-[#F6F7F9]"
                      : isActive
                        ? "border-[#DC2626] bg-[rgba(220,38,38,0.12)] text-[#DC2626]"
                        : "border-[rgba(11,18,32,0.12)] bg-[#F3F4F7] text-[#6B7280]"
                  }`}
                >
                  {isDone ? <Check className="h-3.5 w-3.5" /> : n}
                </span>
                <span
                  className={`hidden font-barlow-condensed text-xs font-bold uppercase tracking-[1.5px] sm:inline ${
                    isActive
                      ? "text-[#DC2626]"
                      : isDone
                        ? "text-[#0B1220]"
                        : "text-[#6B7280]"
                  }`}
                >
                  {label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <span
                  className={`mx-2 h-px flex-1 ${
                    isDone ? "bg-[rgba(220,38,38,0.4)]" : "bg-[rgba(11,18,32,0.1)]"
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

"use client";

import { Fragment } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";

type SportKey = "football" | "basketball" | "multisport";

type CreateLeagueHeaderProps = {
  step: number;
  totalSteps: number;
  leagueName: string;
  sport?: SportKey;
  teamSize?: number;
  competitionType?: "draft" | "budget";
};

const stepLabels = ["Basic Info", "Settings", "Summary"];

const sportBadge: Record<SportKey, { icon: string; label: string }> = {
  football: { icon: "⚽", label: "Football" },
  basketball: { icon: "🏀", label: "Basketball" },
  multisport: { icon: "⚽🏀", label: "Multi-Sport" },
};

function PreviewChip({ children }: { children: React.ReactNode }) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <motion.span
      initial={prefersReducedMotion ? false : { opacity: 0, y: -4, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/8 px-3 py-1 font-barlow-condensed text-[11px] font-700 uppercase tracking-[1px] text-accent"
    >
      {children}
    </motion.span>
  );
}

export function CreateLeagueHeader({
  step,
  totalSteps,
  leagueName,
  sport,
  teamSize,
  competitionType,
}: CreateLeagueHeaderProps) {
  const clampedStep = Math.min(Math.max(step, 1), totalSteps);
  const steps = stepLabels.slice(0, totalSteps);
  const badge = sport ? sportBadge[sport] : null;

  return (
    <div>
      <p className="section-label">Create League</p>
      <h1 className="mt-2 truncate font-bebas text-4xl tracking-[3px] text-fg-1 sm:text-5xl">
        {leagueName ? leagueName : "New League"}
      </h1>

      {/* Live preview — reflects choices back instantly so the flow reads as
          "building something", not just filling in fields. */}
      {badge || teamSize || competitionType ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {badge ? (
            <PreviewChip>
              <span aria-hidden="true">{badge.icon}</span>
              {badge.label}
            </PreviewChip>
          ) : null}
          {teamSize ? (
            <PreviewChip>{teamSize} Teams</PreviewChip>
          ) : null}
          {competitionType ? (
            <PreviewChip>
              {competitionType === "budget" ? "Budget Mode" : "Draft Mode"}
            </PreviewChip>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 flex items-center">
        {steps.map((label, index) => {
          const n = index + 1;
          const isDone = n < clampedStep;
          const isActive = n === clampedStep;
          return (
            <Fragment key={label}>
              <div className="flex items-center gap-2">
                <motion.span
                  animate={{ scale: isActive ? 1.12 : 1 }}
                  transition={{ type: "spring", stiffness: 420, damping: 26 }}
                  className={`grid size-7 shrink-0 place-items-center rounded-full border font-bebas text-sm leading-none ${
                    isDone
                      ? "border-accent bg-accent text-surface-0"
                      : isActive
                        ? "border-accent bg-accent/12 text-accent"
                        : "border-white/12 bg-surface-3 text-fg-3"
                  }`}
                >
                  {isDone ? <Check size={14} strokeWidth={3} /> : n}
                </motion.span>
                <span
                  className={`hidden font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] sm:inline ${
                    isActive
                      ? "text-accent"
                      : isDone
                        ? "text-fg-1"
                        : "text-fg-3"
                  }`}
                >
                  {label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <span className="relative mx-2 h-px flex-1 overflow-hidden bg-white/10">
                  <motion.span
                    className="absolute inset-y-0 left-0 w-full origin-left bg-accent/40"
                    initial={false}
                    animate={{ scaleX: isDone ? 1 : 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  />
                </span>
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

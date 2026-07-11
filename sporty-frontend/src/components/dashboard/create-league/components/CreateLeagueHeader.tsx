"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Stepper } from "@/components/ui";

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
      className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/8 px-3 py-1 font-sans text-[11px] font-700 uppercase tracking-[1px] text-accent"
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
  const steps = stepLabels.slice(0, totalSteps);
  const badge = sport ? sportBadge[sport] : null;

  return (
    <div>
      <p className="section-label">Create League</p>
      <h1 className="mt-2 truncate font-display text-4xl tracking-[-0.02em] text-fg-1 sm:text-5xl">
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

      <Stepper steps={steps} active={step} className="mt-5" />
    </div>
  );
}
